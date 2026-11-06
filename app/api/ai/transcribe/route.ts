// Voice note -> text via 0G Private Computer. Audio is forwarded, never stored.
import { serverEnv } from "@/lib/server/env";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import { routerTranscribe, routerTranscribeViaChat, UpstreamError } from "@/lib/server/zerog";

export const maxDuration = 60;

const MAX_AUDIO = 2 * 1024 * 1024; // ~45 s of Opus is well under this

export async function POST(req: Request) {
  const rl = rateLimit(`stt:${clientIp(req)}`, 15, 10 * 60_000);
  if (!rl.ok) return limited(rl.retryAfter);
  if (!serverEnv.zgApiKey) return json({ error: "Voice logging is not configured on this server (missing 0G API key)." }, 503);

  let file: File | null = null;
  try {
    const fd = await req.formData();
    const f = fd.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!file || file.size === 0) return json({ error: "No audio received." }, 400);
  if (file.size > MAX_AUDIO) return json({ error: "Recording is too long." }, 413);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28_000);
  try {
    try {
      return json(await routerTranscribe(file, file.name || "voice.webm", ctrl.signal));
    } catch (e) {
      // If the speech-to-text model is not routable, fall back to an audio-capable chat model.
      const status = (e as { upstreamStatus?: number }).upstreamStatus;
      if (status && status !== 400 && status !== 404 && status !== 500 && status !== 502 && status !== 503) throw e;
      const fmt = file.type.includes("mp4") ? "mp4" : file.type.includes("ogg") ? "ogg" : "webm";
      const out = await routerTranscribeViaChat(new Uint8Array(await file.arrayBuffer()), fmt, ctrl.signal);
      return json(out);
    }
  } catch (e) {
    if (ctrl.signal.aborted) return json({ error: "Transcription took too long. Please retry." }, 504);
    if (e instanceof UpstreamError) return json({ error: e.message }, e.status);
    return json({ error: "Could not reach the AI service." }, 502);
  } finally {
    clearTimeout(timer);
  }
}
