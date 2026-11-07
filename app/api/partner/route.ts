// Partner links: a long-lived, account-to-account view of a limited cycle summary.
//
// The server only ever stores ciphertext:
// - `payload` is the partner package sealed with a partner key K that lives in
//   the owner's vault and in the invite link's #fragment.
// - `wrapped` is K sealed for the partner with a key derived from their own
//   account signature, so they can open it after signing in on any device.
// Writes need a secret token (we store only its SHA-256): the owner's write
// token for updates/removal, the partner's token for leaving.
import { createHash, timingSafeEqual } from "node:crypto";
import { isAddress } from "viem";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import { deletePartner, getPartner, listPartnersFor, savePartner } from "@/lib/server/db";

const ID_RE = /^[A-Za-z0-9_-]{16,32}$/;
const B64_RE = /^[A-Za-z0-9_-]+$/;
const MAX_PAYLOAD = 64 * 1024;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function sameHash(token: unknown, hash: string | undefined): boolean {
  if (typeof token !== "string" || !hash) return false;
  const a = Buffer.from(sha(token), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const okPayload = (p: unknown): p is string => typeof p === "string" && p.length > 0 && p.length <= MAX_PAYLOAD && B64_RE.test(p);

export async function GET(req: Request) {
  const rl = rateLimit(`partner-get:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) return limited(rl.retryAfter);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const partner = url.searchParams.get("partner");

  if (id) {
    const s = await getPartner(id);
    if (!s) return json({ link: null });
    return json({ link: { id: s.id, owner: s.owner, payload: s.payload, updatedAt: s.updatedAt, claimed: !!s.partner, partner: s.partner ?? null } });
  }

  if (partner && isAddress(partner)) {
    const links = await listPartnersFor(partner);
    return json({ links });
  }

  return json({ error: "Provide id or partner" }, 400);
}

export async function POST(req: Request) {
  const rl = rateLimit(`partner-post:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return limited(rl.retryAfter);
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const id = typeof b.id === "string" ? b.id : "";
  if (!ID_RE.test(id)) return json({ error: "Bad link ID" }, 400);
  const now = Date.now();

  switch (b.action) {
    case "create": {
      if (typeof b.owner !== "string" || !isAddress(b.owner)) return json({ error: "Bad owner" }, 400);
      if (typeof b.writeToken !== "string" || b.writeToken.length < 32) return json({ error: "Bad token" }, 400);
      if (!okPayload(b.payload)) return json({ error: "Bad payload" }, 400);
      if (await getPartner(id)) return json({ error: "Link already exists" }, 409);
      await savePartner({ id, owner: b.owner.toLowerCase(), writeHash: sha(b.writeToken), payload: b.payload, createdAt: now, updatedAt: now });
      return json({ ok: true });
    }
    case "update": {
      const s = await getPartner(id);
      if (!s) return json({ error: "This partner link was removed." }, 404);
      if (!sameHash(b.writeToken, s.writeHash)) return json({ error: "Not allowed" }, 403);
      if (!okPayload(b.payload)) return json({ error: "Bad payload" }, 400);
      await savePartner({ ...s, payload: b.payload, updatedAt: now });
      return json({ ok: true, claimed: !!s.partner });
    }
    case "claim": {
      const s = await getPartner(id);
      if (!s) return json({ error: "This invite is no longer valid. Ask for a new one." }, 404);
      if (typeof b.partner !== "string" || !isAddress(b.partner)) return json({ error: "Bad account" }, 400);
      const partner = b.partner.toLowerCase();
      if (partner === s.owner) return json({ error: "This is your own invite. Send it to your partner instead." }, 400);
      if (s.partner && s.partner !== partner) return json({ error: "This invite was already used by another account. Ask for a new one." }, 409);
      if (!okPayload(b.wrapped) || typeof b.partnerToken !== "string" || b.partnerToken.length < 32) return json({ error: "Bad request" }, 400);
      await savePartner({ ...s, partner, wrapped: b.wrapped, partnerHash: sha(b.partnerToken), claimedAt: s.claimedAt ?? now });
      return json({ ok: true });
    }
    case "remove": {
      const s = await getPartner(id);
      if (!s) return json({ ok: true });
      if (!sameHash(b.writeToken, s.writeHash) && !sameHash(b.partnerToken, s.partnerHash)) return json({ error: "Not allowed" }, 403);
      await deletePartner(id);
      return json({ ok: true });
    }
    default:
      return json({ error: "Unknown action" }, 400);
  }
}
