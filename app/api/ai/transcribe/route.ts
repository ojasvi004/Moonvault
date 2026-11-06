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
    const fmt = file.type.includes("mp4") || file.type.includes("m4a") ? "mp4" : file.type.includes("ogg") ? "ogg" : file.type.includes("wav") ? "wav" : "webm";
    try {
      const out = await routerTranscribe(file, file.name || `voice.${fmt}`, ctrl.signal);
      if (out.text.trim()) return json(out);
      throw new UpstreamError("Empty transcript", 502);
    } catch (e) {
      if (ctrl.signal.aborted) throw e;
      // Speech-to-text failed or isn't routable: fall back to an audio-capable chat model.
      // Only credential/balance/rate-limit errors are final (the fallback would fail the same way).
      const status = (e as { upstreamStatus?: number }).upstreamStatus;
      if (status === 401 || status === 402 || status === 403 || status === 429) throw e;
      console.warn("[transcribe] speech-to-text failed, using audio chat fallback:", e instanceof Error ? e.message : e);
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
