// Text -> speech via 0G Private Computer, used to read AI answers aloud.
// The text is an AI answer the user already has; nothing is logged or stored.
import { serverEnv } from "@/lib/server/env";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import { routerSpeak, UpstreamError } from "@/lib/server/zerog";

export const maxDuration = 60;

const MAX_CHARS = 1500;

export async function POST(req: Request) {
  const rl = rateLimit(`tts:${clientIp(req)}`, 30, 10 * 60_000);
  if (!rl.ok) return limited(rl.retryAfter);
  if (!serverEnv.zgApiKey) return json({ error: "Read-aloud is not configured on this server." }, 503);

  let text = "";
  try {
    const body = (await req.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!text) return json({ error: "Nothing to read." }, 400);
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28_000);
  try {
    const { audio, requestId } = await routerSpeak(text, ctrl.signal);
    return new Response(audio, {
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store", "x-request-id": requestId },
    });
  } catch (e) {
    if (ctrl.signal.aborted) return json({ error: "Read-aloud took too long. Please retry." }, 504);
    if (e instanceof UpstreamError) return json({ error: e.message }, e.status);
    return json({ error: "Could not reach the speech service." }, 502);
  } finally {
    clearTimeout(timer);
  }
}
