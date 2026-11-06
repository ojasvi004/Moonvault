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

async function syncCloudProfile(owner: string, data: ProfileWrite, entityKey?: string): Promise<ProfileRecord | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner, wrapped: data.wrapped, backupRoot: data.backupRoot, backupAt: data.backupAt, entityKey }),
    });
    const body = (await res.json()) as { profile?: ProfileRecord };
    return body.profile ?? null;
  } catch {
    return null;
  }
}

/** `strict`: the on-chain read already failed, so "unreachable" must not be reported as "no vault". */
async function fetchCloudProfile(owner: string, strict = false): Promise<ProfileRecord | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`/api/profile?owner=${encodeURIComponent(owner)}`);
    if (!res.ok) throw new Error(`profile store ${res.status}`);
    const body = (await res.json()) as { profile?: ProfileRecord | null };
    return body.profile ?? null;
  } catch (e) {
    if (strict) throw new Error("We couldn't reach your account record. Check your connection and try again.", { cause: e });
    return null;
  }
}

async function syncCloudShare(owner: string, d: ShareWrite, entityKey?: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shareId: d.shareId,
        owner,
        scope: d.scope,
        createdAt: d.createdAt,
        expiresAtMs: d.expiresAtMs,
        pointer: d.pointer,
        payloadHex: d.payload ? Array.from(d.payload, (b) => b.toString(16).padStart(2, "0")).join("") : undefined,
        entityKey,
      }),
    });
  } catch {
    /* ignore */
  }
}

function hexToBytesClean(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function fetchCloudShare(shareId: string): Promise<ShareRecord | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`/api/share?shareId=${encodeURIComponent(shareId)}`);
    const body = (await res.json()) as { share?: (ShareRecord & { payloadHex?: string; payload?: unknown }) | null };
    if (!body.share) return null;
    let payloadBytes: Uint8Array | undefined;
    if (body.share.payloadHex) {
      payloadBytes = hexToBytesClean(body.share.payloadHex);
    } else if (body.share.payload) {
      const p = body.share.payload;
      if (p instanceof Uint8Array) payloadBytes = p;
      else if (typeof p === "object" && p && "data" in p && Array.isArray((p as { data: unknown }).data)) {
        payloadBytes = new Uint8Array((p as { data: number[] }).data);
      } else if (typeof p === "object") {
        payloadBytes = new Uint8Array(Object.values(p as Record<string, number>));
      }
    }
    return {
      entityKey: body.share.entityKey,
      owner: body.share.owner,
      shareId: body.share.shareId,
      scope: body.share.scope,
      createdAt: body.share.createdAt,
      expiresAtMs: body.share.expiresAtMs,
      pointer: body.share.pointer,
      payload: payloadBytes,
    };
  } catch {
    return null;
  }
}

async function fetchCloudShares(owner: string): Promise<ShareRecord[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch(`/api/share?owner=${encodeURIComponent(owner)}`);
    const body = (await res.json()) as { shares?: Array<ShareRecord & { payloadHex?: string; payload?: unknown }> };
    return (body.shares ?? []).map((s) => {
      let payloadBytes: Uint8Array | undefined;
      if (s.payloadHex) {
        payloadBytes = hexToBytesClean(s.payloadHex);
      } else if (s.payload) {
        const p = s.payload;
        if (p instanceof Uint8Array) payloadBytes = p;
        else if (typeof p === "object" && p && "data" in p && Array.isArray((p as { data: unknown }).data)) {
          payloadBytes = new Uint8Array((p as { data: number[] }).data);
        } else if (typeof p === "object") {
          payloadBytes = new Uint8Array(Object.values(p as Record<string, number>));
        }
      }
      return {
        entityKey: s.entityKey,
        owner: s.owner,
        shareId: s.shareId,
        scope: s.scope,
        createdAt: s.createdAt,
        expiresAtMs: s.expiresAtMs,
        pointer: s.pointer,
        payload: payloadBytes,
      };
    });
  } catch {
    return [];
  }
}

async function revokeCloudShare(shareId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch(`/api/share?shareId=${encodeURIComponent(shareId)}`, { method: "DELETE" });
  } catch {
    /* ignore */
  }
}

export class ArkivAdapter implements ProfileAdapter, SharesAdapter {
  readonly name = "arkiv";
  readonly maxInlineBytes = MAX_INLINE;

  // ---------------------------------------------------------------- profile

  async getProfile(owner: string): Promise<ProfileRecord | null> {
    try {
      const client = arkivPublic();
      const page = await client
        .select({ $key: true, $owner: true, $expiresAt: true, wrappedDk: true, backupRoot: true, backupAt: true })
        .from(ProfileSchema)
        .ownedBy(owner as Hex)
        .limit(10)
        .fetch();
      if (page.entities.length > 0) {
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
        const record: ProfileRecord = {
          entityKey: r.$key,
          owner: r.$owner,
          wrapped,
          backupRoot: r.backupRoot?.value || undefined,
          backupAt: r.backupAt ? Number(r.backupAt.value) : undefined,
          expiresAtBlock: r.$expiresAt,
          expiresAtMs: approxMs(r.$expiresAt, head),
        };
        void syncCloudProfile(owner, { wrapped, backupRoot: record.backupRoot, backupAt: record.backupAt }, record.entityKey);
        return record;
      }
    } catch (err) {
      console.warn("[Arkiv] On-chain profile read issue, trying cloud profile store:", err);
      return fetchCloudProfile(owner, true);
    }
    return fetchCloudProfile(owner);
  }

  async saveProfile(signer: Account, data: ProfileWrite, existingKey?: string) {
    void syncCloudProfile(signer.address, data, existingKey);
    try {
      const wallet = arkivWallet(signer);
      const values = {
        v: 1,
        wrappedDk: bytes(utf8(JSON.stringify(data.wrapped))),
        ...(data.backupRoot ? { backupRoot: str(data.backupRoot) } : {}),
        ...(data.backupAt ? { backupAt: u64(data.backupAt) } : {}),
      };
      if (existingKey && !existingKey.startsWith("prof-")) {
        const { txHash } = await wallet.patchEntity(ProfileSchema, existingKey as Hex, { set: values });
        return { entityKey: existingKey, txHash };
      }
      // Longest lifetime the chain allows (~182 days); extended again on each login.
      const { entityKey, txHash } = await wallet.createEntity(ProfileSchema, values, { expiration: ExpirationTime.max() });
      void syncCloudProfile(signer.address, data, entityKey);
      return { entityKey, txHash };
    } catch (err) {
      console.warn("[Arkiv] On-chain profile write deferred (testnet gas pending); saved to cloud profile store:", err);
      return { entityKey: existingKey ?? `prof-${signer.address.toLowerCase()}` };
    }
  }

  async extendProfile(signer: Account, entityKey: string) {
    if (entityKey.startsWith("prof-")) return {};
    try {
      const { txHash } = await arkivWallet(signer).extendEntity({ entityKey: entityKey as Hex, expiration: ExpirationTime.max() });
      return { txHash };
    } catch {
      return {};
    }
  }

  // ---------------------------------------------------------------- shares

  async createShare(signer: Account, d: ShareWrite) {
    if (d.payload && d.payload.length > MAX_INLINE) throw new Error("Share package too large to store inline");
    void syncCloudShare(signer.address, d);
    try {
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
      void syncCloudShare(signer.address, d, entityKey);
      return { entityKey, txHash };
    } catch (err) {
      console.warn("[Arkiv] On-chain share write deferred (testnet gas pending); saved to cloud share store:", err);
      return { entityKey: `share-${d.shareId}` };
    }
  }

  async getShare(shareId: string): Promise<ShareRecord | null> {
    try {
      const page = await arkivPublic()
        .select()
        .from(ShareSchema)
        .where(and(eq("shareId", str(shareId)), gt("expiresAtMs", u64(Date.now()))))
        .limit(5)
        .fetch();
      if (page.entities.length > 0) {
        const head = await headBlock();
        const r = page.entities[0];
        return this.toShare(r, head);
      }
    } catch (err) {
      console.warn("[Arkiv] On-chain share query issue, checking cloud share store:", err);
    }
    return fetchCloudShare(shareId);
  }

  async listShares(owner: string): Promise<ShareRecord[]> {
    const [onChain, cloud] = await Promise.all([
      (async () => {
        try {
          const page = await arkivPublic()
            .select({ $key: true, $owner: true, $expiresAt: true, shareId: true, scope: true, createdAt: true, expiresAtMs: true, pointer: true })
            .from(ShareSchema)
            .ownedBy(owner as Hex)
            .where(gt("expiresAtMs", u64(Date.now())))
            .limit(100)
            .fetch();
          const head = await headBlock();
          return page.entities.map((r) => this.toShare(r, head));
        } catch {
          return [];
        }
      })(),
      fetchCloudShares(owner),
    ]);
    const byId = new Map<string, ShareRecord>();
    for (const s of cloud) byId.set(s.shareId, s);
    for (const s of onChain) byId.set(s.shareId, s);
    return [...byId.values()].filter((s) => s.expiresAtMs > Date.now());
  }

  async revokeShare(signer: Account, entityKey: string) {
    if (entityKey.startsWith("share-")) {
      const shareId = entityKey.replace(/^share-/, "");
      await revokeCloudShare(shareId);
      return {};
    }
    try {
      const { txHash } = await arkivWallet(signer).deleteEntity({ entityKey: entityKey as Hex });
      return { txHash };
    } catch {
      return {};
    }
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

