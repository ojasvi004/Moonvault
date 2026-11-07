// Cloud profile store fallback. Keeps an encrypted profile (wrapped DK + backup pointer)
// synced server-side so restore works across devices even when on-chain writes are pending gas.
import { isAddress } from "viem";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import type { ProfileRecord } from "@/lib/adapters/types";
import { getProfile, saveProfile, type StoredProfile } from "@/lib/server/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") ?? "";
  if (!isAddress(owner)) return json({ error: "Invalid owner address" }, 400);

  try {
    const profile = await getProfile(owner);
    return json({ profile });
  } catch {
    return json({ profile: null });
  }
}

export async function POST(req: Request) {
  const rl = rateLimit(`prof:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return limited(rl.retryAfter);

  try {
    const body = (await req.json()) as {
      owner?: string;
      wrapped?: unknown;
      backupRoot?: string;
      backupAt?: number;
      entityKey?: string;
    };
    const owner = String(body.owner ?? "").toLowerCase();
    if (!isAddress(owner)) return json({ error: "Invalid owner address" }, 400);
    if (!body.wrapped) return json({ error: "Missing wrapped key" }, 400);

    const existing = await getProfile(owner);

    const record: StoredProfile = {
      entityKey: body.entityKey || existing?.entityKey || `prof-${owner}`,
      owner,
      wrapped: body.wrapped,
      backupRoot: body.backupRoot ?? existing?.backupRoot,
      backupAt: body.backupAt ?? existing?.backupAt,
      expiresAtMs: Date.now() + 182 * 24 * 3600_000,
    };

    await saveProfile(owner, record);
    return json({ ok: true, profile: record as ProfileRecord });
  } catch (err) {
    console.error("[API Profile] Save error:", err);
    return json({ error: "Could not save profile" }, 500);
  }
}
