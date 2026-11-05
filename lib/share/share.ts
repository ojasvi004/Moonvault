// Time-limited share links.
//
// link = /s/<shareId>#<shareKey>   (both base64url)
// The share key lives only in the URL fragment, which browsers never send to
// any server. The public record holds only ciphertext + generic metadata.
import { gunzipSync, gzipSync } from "fflate";
import { getRecords, getStorage, type ShareRecord } from "@/lib/adapters";
import { getSigner } from "@/lib/auth/auth";
import { ensureGas } from "@/lib/auth/gas";
import { CTX, DecryptionError, decryptBytes, encryptBytes, fromBase64Url, memzero, newShareKey, toBase64Url } from "@/lib/crypto";
import { fromUtf8, utf8 } from "@/lib/crypto/encoding";
import { computeStats } from "@/lib/cycle/cycle";
import { addDays, todayISO } from "@/lib/cycle/dates";
import type { Entry, LocalShare, ShareScope, SharePackage } from "@/lib/types";
import { listRecords, putRecord } from "@/lib/vault/records";
import { withRetry } from "@/lib/util/retry";

type SealedPackage = SharePackage & { shareId: string };

export function buildPackage(entries: Entry[], scope: ShareScope, months: number, expiresAt: number, now = Date.now()): SharePackage {
  const to = todayISO();
  const from = addDays(to, -Math.round(months * 30.5));
  const inRange = entries.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const stats = computeStats(inRange);
  const mapped = inRange
    .filter((e) => scope !== "dates" || e.flow !== "none")
    .map((e) => {
      if (scope === "dates") return { date: e.date, flow: e.flow };
      if (scope === "dates_symptoms") return { date: e.date, flow: e.flow, symptoms: e.symptoms, symptomsText: e.symptomsText };
      return {
        date: e.date,
        flow: e.flow,
        symptoms: e.symptoms,
        symptomsText: e.symptomsText,
        mood: e.mood,
        sleepHours: e.sleepHours,
        notes: e.notes,
      };
    });
  return {
    v: 1,
    scope,
    createdAt: now,
    expiresAt,
    range: { from, to },
    entries: mapped,
    stats: { avgCycle: stats.avgCycle, avgPeriod: stats.avgPeriod, cycles: stats.cyclesTracked },
  };
}

export async function sealPackage(key: Uint8Array, pkg: SealedPackage): Promise<Uint8Array> {
  return encryptBytes(key, gzipSync(utf8(JSON.stringify(pkg)), { level: 9 }), CTX.share);
}

export async function openPackage(key: Uint8Array, sealed: Uint8Array, shareId: string): Promise<SharePackage> {
  const gz = await decryptBytes(key, sealed, CTX.share);
  const pkg = JSON.parse(fromUtf8(gunzipSync(gz))) as SealedPackage;
  if (pkg.shareId !== shareId) throw new DecryptionError("This link does not match its data.");
  return pkg;
}

export type CreateShareInput = {
  recipientLabel: string;
  scope: ShareScope;
  durationMs: number;
  months: number;
};

export async function createShare(input: CreateShareInput, onStep?: (label: string) => void): Promise<LocalShare> {
  const entries = await listRecords("entries");
  const now = Date.now();
  const expiresAt = now + input.durationMs;
  const shareId = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const key = await newShareKey();
  try {
    onStep?.("Encrypting");
    const pkg = buildPackage(entries, input.scope, input.months, expiresAt, now);
    const sealed = await sealPackage(key, { ...pkg, shareId });
    const records = await getRecords();
    let payload: Uint8Array | undefined = sealed;
    let pointer: string | undefined;
    if (sealed.length > records.maxInlineBytes) {
      onStep?.("Uploading large package");
      pointer = (await withRetry(() => getStorage().upload(sealed))).root;
      payload = undefined;
    }
    onStep?.("Creating link");
    const signer = await getSigner();
    await ensureGas(signer.address);
    const { entityKey } = await withRetry(
      () => records.createShare(signer, { shareId, scope: input.scope, createdAt: now, expiresAtMs: expiresAt, payload, pointer }),
      { attempts: 3 },
    );
    const link = `${window.location.origin}/s/${shareId}#${toBase64Url(key)}`;
    const local: LocalShare = {
      shareId,
      entityKey,
      recipientLabel: input.recipientLabel.slice(0, 60),
      scope: input.scope,
      createdAt: now,
      expiresAt,
      link,
    };
    await putRecord("shares", shareId, local);
    return local;
  } finally {
    await memzero(key);
  }
}

export class ShareUnavailableError extends Error {
  constructor(public reason: "expired" | "missing-key" | "bad-key") {
    super(
      reason === "expired"
        ? "This link has expired or was revoked."
        : reason === "missing-key"
          ? "This link is incomplete. Ask for the full link, including everything after the # sign."
          : "This link could not be opened. It may have been copied incorrectly.",
    );
    this.name = "ShareUnavailableError";
  }
}

/** Doctor view: read-only, no account needed. */
export async function readShare(shareId: string, keyText: string): Promise<{ pkg: SharePackage; record: ShareRecord }> {
  if (!keyText) throw new ShareUnavailableError("missing-key");
  let key: Uint8Array;
  try {
    key = fromBase64Url(keyText);
    if (key.length !== 32) throw new Error();
  } catch {
    throw new ShareUnavailableError("bad-key");
  }
  try {
    const records = await getRecords();
    const record = await withRetry(() => records.getShare(shareId), { attempts: 3 });
    if (!record || record.expiresAtMs <= Date.now()) throw new ShareUnavailableError("expired");
    const sealed = record.payload ?? (record.pointer ? await withRetry(() => getStorage().download(record.pointer!)) : undefined);
    if (!sealed) throw new ShareUnavailableError("expired");
    let pkg: SharePackage;
    try {
      pkg = await openPackage(key, sealed, shareId);
    } catch {
      throw new ShareUnavailableError("bad-key");
    }
    // App-level check too (matters for the pointer fallback, see README).
    if (pkg.expiresAt <= Date.now()) throw new ShareUnavailableError("expired");
    return { pkg, record };
  } finally {
    await memzero(key);
  }
}

export async function revokeShare(local: LocalShare): Promise<void> {
  const records = await getRecords();
  const signer = await getSigner();
  await ensureGas(signer.address);
  await withRetry(() => records.revokeShare(signer, local.entityKey), { attempts: 3 });
  await putRecord("shares", local.shareId, { ...local, revoked: true });
}

export type ActiveShare = ShareRecord & { local?: LocalShare };

/** Active shares come from the public records (queried by owner), labelled with local names. */
export async function listActiveShares(owner: string): Promise<ActiveShare[]> {
  const records = await getRecords();
  const [remote, locals] = await Promise.all([records.listShares(owner), listRecords("shares").catch(() => [] as LocalShare[])]);
  const byId = new Map(locals.map((l) => [l.shareId, l]));
  return remote
    .filter((r) => r.expiresAtMs > Date.now())
    .map((r) => ({ ...r, local: byId.get(r.shareId) }))
    .sort((a, b) => a.expiresAtMs - b.expiresAtMs);
}

export function whatsappLink(link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`Here is a private, time-limited view of my cycle notes: ${link}`)}`;
}
