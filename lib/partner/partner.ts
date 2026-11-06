// Partner sharing: a lasting link between two accounts.
//
// Owner side: an invite holds a random partner key K in its #fragment. The owner's
// vault keeps K and keeps the partner's encrypted summary up to date whenever
// entries change.
// Partner side: on accepting, K is sealed with a key derived from a signature by
// the partner's own account (deterministic, never leaves the browser) and stored
// with the link. Signing in on any device is then enough to open the summary.
//
// The partner only ever sees a limited summary (no symptoms, notes or sleep;
// mood only if the owner opts in), and the server only ever sees ciphertext.
import { gunzipSync, gzipSync } from "fflate";
import { getSigner } from "@/lib/auth/auth";
import { CTX, decryptBytes, encryptBytes, fromBase64Url, newShareKey, toBase64Url } from "@/lib/crypto";
import { fromUtf8, utf8 } from "@/lib/crypto/encoding";
import { computeStats, cycleDays, phaseFor, predict, type Phase } from "@/lib/cycle/cycle";
import { addDays, todayISO } from "@/lib/cycle/dates";
import type { Entry, LocalShare, Mood } from "@/lib/types";
import { listRecords, putRecord, subscribeRecords } from "@/lib/vault/records";

export type PartnerPackage = {
  v: 1;
  ownerName: string;
  updatedAt: number;
  asOf: string; // the owner's "today" when this was built
  avgCycle: number;
  avgPeriod: number;
  confidence: "low" | "medium" | "high";
  lastPeriodStart?: string;
  periodOngoing: boolean; // bleeding logged on asOf or the day before
  next?: { start: string; end: string; fertileStart: string; fertileEnd: string; ovulation: string };
  upcoming: Array<{ start: string; end: string }>;
  recentPeriods: Array<{ start: string; end: string }>;
  mood?: { date: string; mood: Mood };
};

export type PartnerLocal = LocalShare & { kind: "partner"; partnerKey: string; writeToken: string };

const BLEEDING = new Set(["light", "medium", "heavy"]);

export function buildPartnerPackage(entries: Entry[], opts: { ownerName: string; includeMood: boolean }, now = Date.now()): PartnerPackage {
  const today = todayISO();
  const stats = computeStats(entries);
  const preds = predict(stats, today, 3).filter((p) => p.nextEnd >= today);
  const last = stats.periods[stats.periods.length - 1];
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const periodOngoing = [today, addDays(today, -1)].some((d) => BLEEDING.has(byDate.get(d)?.flow ?? ""));
  const recentMood = opts.includeMood
    ? entries
        .filter((e) => e.mood && e.date >= addDays(today, -2))
        .sort((a, b) => b.date.localeCompare(a.date))[0]
    : undefined;
  const n = preds[0];
  return {
    v: 1,
    ownerName: opts.ownerName.trim().slice(0, 40) || "Your partner",
    updatedAt: now,
    asOf: today,
    avgCycle: stats.avgCycle,
    avgPeriod: stats.avgPeriod,
    confidence: stats.confidence,
    lastPeriodStart: last?.start,
    periodOngoing,
    next: n ? { start: n.nextStart, end: n.nextEnd, fertileStart: n.fertileStart, fertileEnd: n.fertileEnd, ovulation: n.ovulation } : undefined,
    upcoming: preds.map((p) => ({ start: p.nextStart, end: p.nextEnd })),
    recentPeriods: stats.periods.slice(-3).map((p) => ({ start: p.start, end: p.end })),
    mood: recentMood?.mood ? { date: recentMood.date, mood: recentMood.mood } : undefined,
  };
}

/** Where the owner is in the cycle on `date`, computed by the viewer so a summary stays correct for days. */
export function partnerToday(pkg: PartnerPackage, date = todayISO()): { cycleDay?: number; phase?: Phase; onPeriod: boolean } {
  const starts = [...pkg.recentPeriods.map((p) => p.start), ...pkg.upcoming.map((p) => p.start)].filter((s) => s <= date).sort();
  const start = starts[starts.length - 1];
  if (!start) return { onPeriod: false };
  const cycleDay = cycleDays([{ date } as Entry], [{ start, end: start, length: 1 }]).get(date);
  const inLogged = pkg.recentPeriods.some((p) => date >= p.start && date <= p.end) || (pkg.periodOngoing && date === pkg.asOf);
  const inPredicted = pkg.upcoming.some((p) => date >= p.start && date <= p.end);
  return { cycleDay, phase: cycleDay ? phaseFor(cycleDay, pkg.avgCycle, pkg.avgPeriod) : undefined, onPeriod: inLogged || inPredicted };
}

async function seal(key: Uint8Array, pkg: PartnerPackage): Promise<string> {
  return toBase64Url(await encryptBytes(key, gzipSync(utf8(JSON.stringify(pkg)), { level: 9 }), CTX.partner));
}

async function open(key: Uint8Array, payload: string): Promise<PartnerPackage> {
  return JSON.parse(fromUtf8(gunzipSync(await decryptBytes(key, fromBase64Url(payload), CTX.partner)))) as PartnerPackage;
}

async function api<T>(init: { method: "GET"; query: string } | { method: "POST"; body: Record<string, unknown> }): Promise<T> {
  const res =
    init.method === "GET"
      ? await fetch(`/api/partner?${init.query}`, { cache: "no-store" })
      : await fetch("/api/partner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

// ------------------------------------------------------------------ owner

export async function listPartnerLinks(): Promise<PartnerLocal[]> {
  const all = await listRecords("shares");
  return all.filter((s): s is PartnerLocal => s.kind === "partner" && !s.revoked && !!s.partnerKey && !!s.writeToken).sort((a, b) => a.createdAt - b.createdAt);
}

export async function createPartnerInvite(owner: string, opts: { ownerName: string; includeMood: boolean }): Promise<PartnerLocal> {
  const entries = await listRecords("entries");
  const id = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const key = await newShareKey();
  const writeToken = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const payload = await seal(key, buildPartnerPackage(entries, opts));
  await api({ method: "POST", body: { action: "create", id, owner, writeToken, payload } });
  const now = Date.now();
  const local: PartnerLocal = {
    kind: "partner",
    shareId: id,
    entityKey: `partner-${id}`,
    recipientLabel: "Partner",
    scope: "dates",
    createdAt: now,
    expiresAt: Number.MAX_SAFE_INTEGER,
    link: `${window.location.origin}/partner/join#${id}.${toBase64Url(key)}`,
    partnerKey: toBase64Url(key),
    writeToken,
    ownerName: opts.ownerName,
    includeMood: opts.includeMood,
  };
  await putRecord("shares", id, local);
  return local;
}

export type PartnerStatus = { claimed: boolean; updatedAt: number } | null;

export async function partnerStatus(id: string): Promise<PartnerStatus> {
  const { link } = await api<{ link: { claimed: boolean; updatedAt: number } | null }>({ method: "GET", query: `id=${encodeURIComponent(id)}` });
  return link ? { claimed: link.claimed, updatedAt: link.updatedAt } : null;
}

export async function updatePartnerSettings(local: PartnerLocal, opts: { ownerName: string; includeMood: boolean }): Promise<void> {
  const next = { ...local, ownerName: opts.ownerName, includeMood: opts.includeMood };
  await putRecord("shares", local.shareId, next);
  await pushPartnerUpdates();
}

export async function removePartner(local: PartnerLocal): Promise<void> {
  await api({ method: "POST", body: { action: "remove", id: local.shareId, writeToken: local.writeToken } });
  await putRecord("shares", local.shareId, { ...local, revoked: true });
}

let pushing: Promise<void> | null = null;
let again = false;

/** Re-seal and upload the partner summary for every active partner link. */
export function pushPartnerUpdates(): Promise<void> {
  if (pushing) {
    again = true;
    return pushing;
  }
  pushing = (async () => {
    const links = await listPartnerLinks();
    if (!links.length) return;
    const entries = await listRecords("entries");
    for (const l of links) {
      const payload = await seal(fromBase64Url(l.partnerKey), buildPartnerPackage(entries, { ownerName: l.ownerName ?? "", includeMood: !!l.includeMood }));
      try {
        await api({ method: "POST", body: { action: "update", id: l.shareId, writeToken: l.writeToken, payload } });
      } catch (e) {
        // Removed from the partner's side (or elsewhere): stop syncing it.
        if (e instanceof Error && /removed/i.test(e.message)) await putRecord("shares", l.shareId, { ...l, revoked: true });
        else throw e;
      }
    }
  })().finally(() => {
    pushing = null;
    if (again) {
      again = false;
      void pushPartnerUpdates().catch(() => undefined);
    }
  });
  return pushing;
}

// ------------------------------------------------------------------ partner

const SIGN_MESSAGE =
  "Moonvault partner access (v1)\n\nSigning this lets this browser open the cycle summaries your partner shares with you. Only sign it on the Moonvault website.";

let secretCache: { address: string; secret: Uint8Array } | null = null;

/** 32-byte secret derived from a signature by the signed-in account. */
async function partnerSecret(): Promise<{ address: string; secret: Uint8Array }> {
  const signer = await getSigner();
  const address = signer.address.toLowerCase();
  if (secretCache?.address === address) return secretCache;
  if (!signer.signMessage) throw new Error("This account can't open partner views.");
  const sig = await signer.signMessage({ message: SIGN_MESSAGE });
  const secret = new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(`moonvault-partner-secret:${sig.toLowerCase()}`) as BufferSource));
  secretCache = { address, secret };
  return secretCache;
}

async function partnerToken(secret: Uint8Array, id: string): Promise<string> {
  const bytes = new Uint8Array(secret.length + id.length);
  bytes.set(secret);
  bytes.set(utf8(id), secret.length);
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource)));
}

export class InviteError extends Error {}

export function parseInvite(hash: string): { id: string; key: Uint8Array } {
  const [id, k] = hash.replace(/^#/, "").split(".");
  if (!id || !k) throw new InviteError("This invite link is incomplete. Ask your partner to send it again, including everything after the # sign.");
  try {
    const key = fromBase64Url(k);
    if (key.length !== 32 || !/^[A-Za-z0-9_-]{16,32}$/.test(id)) throw new Error();
    return { id, key };
  } catch {
    throw new InviteError("This invite link looks damaged. Ask your partner to send it again.");
  }
}

/** Read an invite before accepting it (checks it's valid and shows who sent it). */
export async function previewInvite(id: string, key: Uint8Array): Promise<{ pkg: PartnerPackage; owner: string; claimedBy: string | null }> {
  const { link } = await api<{ link: { owner: string; payload: string; partner: string | null } | null }>({ method: "GET", query: `id=${encodeURIComponent(id)}` });
  if (!link) throw new InviteError("This invite is no longer valid. Ask your partner for a new one.");
  try {
    return { pkg: await open(key, link.payload), owner: link.owner, claimedBy: link.partner };
  } catch {
    throw new InviteError("This invite link looks damaged. Ask your partner to send it again.");
  }
}

export async function acceptInvite(id: string, key: Uint8Array): Promise<void> {
  const { address, secret } = await partnerSecret();
  const wrapped = toBase64Url(await encryptBytes(secret, key, CTX.partnerWrap));
  await api({ method: "POST", body: { action: "claim", id, partner: address, wrapped, partnerToken: await partnerToken(secret, id) } });
}

export type PartnerView = { id: string; pkg: PartnerPackage } | { id: string; error: string };

export async function loadPartnerViews(): Promise<PartnerView[]> {
  const { address, secret } = await partnerSecret();
  const { links } = await api<{ links: Array<{ id: string; payload: string; wrapped: string }> }>({ method: "GET", query: `partner=${address}` });
  return Promise.all(
    links.map(async (l): Promise<PartnerView> => {
      try {
        const key = await decryptBytes(secret, fromBase64Url(l.wrapped), CTX.partnerWrap);
        return { id: l.id, pkg: await open(key, l.payload) };
      } catch {
        return { id: l.id, error: "We couldn't open this one on this device. Open the original invite link once more to reconnect." };
      }
    }),
  );
}

export async function leavePartner(id: string): Promise<void> {
  const { secret } = await partnerSecret();
  await api({ method: "POST", body: { action: "remove", id, partnerToken: await partnerToken(secret, id) } });
}

// ------------------------------------------------------------------ copy

export const PHASE_PARTNER_COPY: Record<Phase, { title: string; tip: string }> = {
  menstrual: { title: "On their period", tip: "Energy can be lower. Small things help: a warm drink, a heating pad, or taking a chore off their plate." },
  follicular: { title: "Follicular phase", tip: "Energy often rises after a period. A good time to plan something active together." },
  ovulation: { title: "Around ovulation", tip: "This is the estimated fertile window. Estimates are approximate. Don't rely on them for contraception." },
  luteal: { title: "Luteal phase", tip: "Some people feel more tired or sensitive before a period. Check in and be patient." },
};

// ------------------------------------------------------------------ background sync (owner)

let syncStarted = false;

/** Keep partner summaries fresh: on unlock, after edits, and once an hour (phase/day changes). Idempotent. */
export function startPartnerSync(isUnlocked: () => boolean) {
  if (syncStarted || typeof window === "undefined") return;
  syncStarted = true;
  let t: ReturnType<typeof setTimeout> | null = null;
  const schedule = (ms: number) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      if (isUnlocked() && navigator.onLine) void pushPartnerUpdates().catch((e) => console.warn("[partner] sync deferred:", e));
    }, ms);
  };
  subscribeRecords(() => schedule(3000));
  window.addEventListener("online", () => schedule(1000));
  setInterval(() => schedule(0), 3600_000);
  schedule(1000);
}
