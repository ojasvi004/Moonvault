import { ExpirationTime } from "@arkiv-network/sdk";
import { and, eq, gt } from "@arkiv-network/sdk/query";
import { bytes, str, u64 } from "@arkiv-network/sdk/schema";
import { hexToBytes, type Account, type Hex } from "viem";
import type { WrappedDk } from "@/lib/crypto";
import { fromUtf8, utf8 } from "@/lib/crypto/encoding";
import type { ShareScope } from "@/lib/types";
import type { ProfileAdapter, ProfileRecord, ProfileWrite, ShareRecord, ShareWrite, SharesAdapter } from "../types";
import { ARKIV_BLOCK_MS, arkivPublic, arkivWallet } from "./client";
import { ProfileSchema, ShareSchema } from "./schema";

// 128 KiB is the SDK's per-entity bytes budget; leave room for ABI/RPC overhead.
const MAX_INLINE = 96 * 1024;

const SCOPES: ShareScope[] = ["dates", "dates_symptoms", "full"];

async function headBlock(): Promise<bigint> {
  return arkivPublic().getBlockNumber();
}

function approxMs(block: bigint | undefined, head: bigint): number | undefined {
  if (block === undefined) return undefined;
  return Date.now() + Number(block - head) * ARKIV_BLOCK_MS;
}

export class ArkivAdapter implements ProfileAdapter, SharesAdapter {
  readonly name = "arkiv";
  readonly maxInlineBytes = MAX_INLINE;

  // ---------------------------------------------------------------- profile

  async getProfile(owner: string): Promise<ProfileRecord | null> {
    const client = arkivPublic();
    const page = await client
      .select({ $key: true, $owner: true, $expiresAt: true, wrappedDk: true, backupRoot: true, backupAt: true })
      .from(ProfileSchema)
      .ownedBy(owner as Hex)
      .limit(10)
      .fetch();
    if (page.entities.length === 0) return null;
    // If several exist (e.g. an interrupted first sync), prefer the newest backup.
    const rows = [...page.entities].sort((a, b) => Number((b.backupAt?.value ?? 0n) - (a.backupAt?.value ?? 0n)));
    const r = rows[0];
    const head = await headBlock();
    let wrapped: WrappedDk;
    try {
      wrapped = JSON.parse(fromUtf8(hexToBytes(r.wrappedDk.value))) as WrappedDk;
    } catch {
      throw new Error("The account record is unreadable.");
    }
    return {
      entityKey: r.$key,
      owner: r.$owner,
      wrapped,
      backupRoot: r.backupRoot?.value || undefined,
      backupAt: r.backupAt ? Number(r.backupAt.value) : undefined,
      expiresAtBlock: r.$expiresAt,
      expiresAtMs: approxMs(r.$expiresAt, head),
    };
  }

  async saveProfile(signer: Account, data: ProfileWrite, existingKey?: string) {
    const wallet = arkivWallet(signer);
    const values = {
      v: 1,
      wrappedDk: bytes(utf8(JSON.stringify(data.wrapped))),
      ...(data.backupRoot ? { backupRoot: str(data.backupRoot) } : {}),
      ...(data.backupAt ? { backupAt: u64(data.backupAt) } : {}),
    };
    if (existingKey) {
      const { txHash } = await wallet.patchEntity(ProfileSchema, existingKey as Hex, { set: values });
      return { entityKey: existingKey, txHash };
    }
    // Longest lifetime the chain allows (~182 days); extended again on each login.
    const { entityKey, txHash } = await wallet.createEntity(ProfileSchema, values, { expiration: ExpirationTime.max() });
    return { entityKey, txHash };
  }

  async extendProfile(signer: Account, entityKey: string) {
    const { txHash } = await arkivWallet(signer).extendEntity({ entityKey: entityKey as Hex, expiration: ExpirationTime.max() });
    return { txHash };
  }

  // ---------------------------------------------------------------- shares

  async createShare(signer: Account, d: ShareWrite) {
    if (d.payload && d.payload.length > MAX_INLINE) throw new Error("Share package too large to store inline");
    const seconds = Math.max(60, Math.ceil((d.expiresAtMs - Date.now()) / 1000));
    const { entityKey, txHash } = await arkivWallet(signer).createEntity(
      ShareSchema,
      {
        shareId: d.shareId,
        scope: d.scope,
        createdAt: u64(d.createdAt),
        expiresAtMs: u64(d.expiresAtMs),
        ...(d.payload ? { payload: bytes(d.payload) } : {}),
        ...(d.pointer ? { pointer: str(d.pointer) } : {}),
      },
      { expiration: ExpirationTime.fromSeconds(seconds) },
    );
    return { entityKey, txHash };
  }

  async getShare(shareId: string): Promise<ShareRecord | null> {
    const page = await arkivPublic()
      .select()
      .from(ShareSchema)
      .where(and(eq("shareId", str(shareId)), gt("expiresAtMs", u64(Date.now()))))
      .limit(5)
      .fetch();
    if (page.entities.length === 0) return null;
    const head = await headBlock();
    const r = page.entities[0];
    return this.toShare(r, head);
  }

  async listShares(owner: string): Promise<ShareRecord[]> {
    const page = await arkivPublic()
      .select({ $key: true, $owner: true, $expiresAt: true, shareId: true, scope: true, createdAt: true, expiresAtMs: true, pointer: true })
      .from(ShareSchema)
      .ownedBy(owner as Hex)
      .where(gt("expiresAtMs", u64(Date.now())))
      .limit(100)
      .fetch();
    const head = await headBlock();
    return page.entities.map((r) => this.toShare(r, head));
  }

  async revokeShare(signer: Account, entityKey: string) {
    const { txHash } = await arkivWallet(signer).deleteEntity({ entityKey: entityKey as Hex });
    return { txHash };
  }

  private toShare(
    r: {
      $key: Hex;
      $owner: Hex;
      $expiresAt: bigint;
      shareId: { value: string };
      scope: { value: string };
      createdAt: { value: bigint };
      expiresAtMs: { value: bigint };
      payload?: { value: Hex };
      pointer?: { value: string };
    },
    head: bigint,
  ): ShareRecord {
    const scope = (SCOPES as string[]).includes(r.scope.value) ? (r.scope.value as ShareScope) : "dates";
    const blockMs = approxMs(r.$expiresAt, head) ?? Number(r.expiresAtMs.value);
    return {
      entityKey: r.$key,
      owner: r.$owner,
      shareId: r.shareId.value,
      scope,
      createdAt: Number(r.createdAt.value),
      expiresAtMs: Math.min(Number(r.expiresAtMs.value), blockMs),
      payload: r.payload ? hexToBytes(r.payload.value) : undefined,
      pointer: r.pointer?.value || undefined,
      expiresAtBlock: r.$expiresAt,
    };
  }
}
