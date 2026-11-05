// Download an encrypted blob from 0G Storage by root hash. Returns ciphertext only.
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import { zgDownload } from "@/lib/server/zgStorage";

export const maxDuration = 60;

export async function GET(req: Request) {
  const rl = rateLimit(`down:${clientIp(req)}`, 60, 60 * 60_000);
  if (!rl.ok) return limited(rl.retryAfter);
  const root = new URL(req.url).searchParams.get("root") ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(root)) return json({ error: "Invalid backup reference" }, 400);
  try {
    const bytes = await zgDownload(root);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(bytes.length),
        "cache-control": "private, max-age=3600, immutable",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/not found|no locations|file not found/i.test(msg)) return json({ error: "Backup not found on the network yet. It can take a minute after upload." }, 404);
    return json({ error: "Download from the backup network failed. Please retry." }, 502);
  }
}
