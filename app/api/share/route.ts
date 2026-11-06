// Cloud share store fallback. Keeps encrypted share records available
// even when on-chain writes are waiting for faucet gas.
import fs from "node:fs/promises";
import path from "node:path";
import { isAddress } from "viem";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import type { ShareRecord } from "@/lib/adapters/types";

const SHARES_DIR = path.join(process.cwd(), ".moonvault-storage", "shares");

async function ensureDir() {
  await fs.mkdir(SHARES_DIR, { recursive: true });
}

function fileFor(shareId: string) {
  return path.join(SHARES_DIR, `${shareId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

type StoredShare = Omit<ShareRecord, "payload"> & { payloadHex?: string };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shareId = url.searchParams.get("shareId");
  const owner = url.searchParams.get("owner");

  await ensureDir();

  if (shareId) {
    try {
      const data = await fs.readFile(fileFor(shareId), "utf8");
      const s = JSON.parse(data) as StoredShare;
      if (s.expiresAtMs <= Date.now()) return json({ share: null });
      return json({
        share: {
          entityKey: s.entityKey,
          owner: s.owner,
          shareId: s.shareId,
          scope: s.scope,
          createdAt: s.createdAt,
          expiresAtMs: s.expiresAtMs,
          pointer: s.pointer,
          payloadHex: s.payloadHex,
        },
      });
    } catch {
      return json({ share: null });
    }
  }

  if (owner && isAddress(owner)) {
    try {
      const files = await fs.readdir(SHARES_DIR);
      const shares: Array<Omit<ShareRecord, "payload"> & { payloadHex?: string }> = [];
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const content = await fs.readFile(path.join(SHARES_DIR, f), "utf8");
          const s = JSON.parse(content) as StoredShare;
          if (s.owner?.toLowerCase() === owner.toLowerCase() && s.expiresAtMs > Date.now()) {
            shares.push({
              entityKey: s.entityKey,
              owner: s.owner,
              shareId: s.shareId,
              scope: s.scope,
              createdAt: s.createdAt,
              expiresAtMs: s.expiresAtMs,
              pointer: s.pointer,
              payloadHex: s.payloadHex,
            });
          }
        } catch {
          /* ignore */
        }
      }
      return json({ shares });
    } catch {
      return json({ shares: [] });
    }
  }

  return json({ error: "Provide shareId or owner" }, 400);
}

export async function POST(req: Request) {
  const rl = rateLimit(`share:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return limited(rl.retryAfter);

  try {
    const body = (await req.json()) as {
      shareId?: string;
      owner?: string;
      scope?: string;
      createdAt?: number;
      expiresAtMs?: number;
      payloadHex?: string;
      pointer?: string;
      entityKey?: string;
    };
    if (!body.shareId) return json({ error: "Missing shareId" }, 400);

    await ensureDir();
    const stored: StoredShare = {
      entityKey: body.entityKey || `share-${body.shareId}`,
      owner: body.owner ?? "",
      shareId: body.shareId,
      scope: (body.scope as ShareRecord["scope"]) ?? "dates",
      createdAt: body.createdAt ?? Date.now(),
      expiresAtMs: body.expiresAtMs ?? Date.now() + 7 * 24 * 3600_000,
      pointer: body.pointer,
      payloadHex: body.payloadHex,
    };

    await fs.writeFile(fileFor(body.shareId), JSON.stringify(stored, null, 2), "utf8");
    return json({ ok: true, share: stored });
  } catch {
    return json({ error: "Could not save share" }, 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get("shareId");
    if (!shareId) return json({ error: "Missing shareId" }, 400);
    await fs.unlink(fileFor(shareId)).catch(() => undefined);
    return json({ ok: true });
  } catch {
    return json({ error: "Could not revoke share" }, 500);
  }
}
