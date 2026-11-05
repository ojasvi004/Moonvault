// Upload an encrypted blob to 0G Storage. Accepts only Moonvault ciphertext
// envelopes (backup bundles "MVB\x01" or sealed share packages, version 1).
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import { zgUpload } from "@/lib/server/zgStorage";

export const maxDuration = 120;

const MAX = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB body limit

function looksSealed(b: Uint8Array): boolean {
  const isBundle = b[0] === 0x4d && b[1] === 0x56 && b[2] === 0x42 && b[3] === 0x01;
  const isSealed = b[0] === 0x01;
  return b.length >= 41 && (isBundle || isSealed);
}

export async function POST(req: Request) {
  const rl = rateLimit(`up:${clientIp(req)}`, 20, 60 * 60_000);
  if (!rl.ok) return limited(rl.retryAfter);
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length === 0) return json({ error: "Empty upload" }, 400);
  if (buf.length > MAX) return json({ error: "Backup is too large" }, 413);
  if (!looksSealed(buf)) return json({ error: "Only encrypted data can be uploaded" }, 400);
  try {
    const { root, txHash } = await zgUpload(buf);
    return json({ root, txHash, size: buf.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_CONFIGURED") return json({ error: "Cloud backup is not configured on this server." }, 503);
    if (/insufficient funds|exceeds the balance/i.test(msg)) return json({ error: "The backup relay is out of test funds." }, 503);
    return json({ error: "Upload to the backup network failed. Retrying may help." }, 502);
  }
}
