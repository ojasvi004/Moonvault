// Cloud share store fallback. Keeps encrypted share records available
// even when on-chain writes are waiting for faucet gas.
import { isAddress } from "viem";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import { deleteShare, getShare, listSharesByOwner, saveShare, type StoredShare } from "@/lib/server/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shareId = url.searchParams.get("shareId");
  const owner = url.searchParams.get("owner");

  if (shareId) {
    try {
      const s = await getShare(shareId);
      if (!s) return json({ share: null });
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
      const shares = await listSharesByOwner(owner);
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

    const stored: StoredShare = {
      entityKey: body.entityKey || `share-${body.shareId}`,
      owner: body.owner ?? "",
      shareId: body.shareId,
      scope: body.scope ?? "dates",
      createdAt: body.createdAt ?? Date.now(),
      expiresAtMs: body.expiresAtMs ?? Date.now() + 7 * 24 * 3600_000,
      pointer: body.pointer,
      payloadHex: body.payloadHex,
    };

    await saveShare(stored);
    return json({ ok: true, share: stored });
  } catch (err) {
    console.error("[API Share] Save error:", err);
    return json({ error: "Could not save share" }, 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get("shareId");
    if (!shareId) return json({ error: "Missing shareId" }, 400);
    await deleteShare(shareId);
    return json({ ok: true });
  } catch (err) {
    console.error("[API Share] Delete error:", err);
    return json({ error: "Could not revoke share" }, 500);
  }
}
