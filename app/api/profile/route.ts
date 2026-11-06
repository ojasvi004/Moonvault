// Cloud profile store fallback. Keeps an encrypted profile (wrapped DK + backup pointer)
// synced server-side so restore works across devices even when on-chain writes are pending gas.
import fs from "node:fs/promises";
import path from "node:path";
import { isAddress } from "viem";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import type { ProfileRecord } from "@/lib/adapters/types";

const PROFILES_DIR = path.join(process.cwd(), ".moonvault-storage", "profiles");

async function ensureDir() {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
}

function fileFor(owner: string) {
  return path.join(PROFILES_DIR, `${owner.toLowerCase()}.json`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") ?? "";
  if (!isAddress(owner)) return json({ error: "Invalid owner address" }, 400);

  try {
    await ensureDir();
    const data = await fs.readFile(fileFor(owner), "utf8");
    const profile = JSON.parse(data) as ProfileRecord;
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

    await ensureDir();
    const file = fileFor(owner);
    let existing: Partial<ProfileRecord> = {};
    try {
      existing = JSON.parse(await fs.readFile(file, "utf8")) as Partial<ProfileRecord>;
    } catch {
      /* ignore */
    }

    const record: ProfileRecord = {
      entityKey: body.entityKey || existing.entityKey || `prof-${owner}`,
      owner,
      wrapped: body.wrapped as ProfileRecord["wrapped"],
      backupRoot: body.backupRoot ?? existing.backupRoot,
      backupAt: body.backupAt ?? existing.backupAt,
      expiresAtMs: Date.now() + 182 * 24 * 3600_000,
    };

    await fs.writeFile(file, JSON.stringify(record, null, 2), "utf8");
    return json({ ok: true, profile: record });
  } catch {
    return json({ error: "Could not save profile" }, 500);
  }
}
