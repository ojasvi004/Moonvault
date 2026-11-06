// Server-side client for 0G Private Computer (OpenAI-compatible router).
// The request ID comes from the response body: x_0g_trace.request_id.
import "server-only";
import { serverEnv } from "./env";

export class UpstreamError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type RouterChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { content?: string | Array<{ type: string; text?: string }> } }>;
  x_0g_trace?: { request_id?: string; provider?: string };
  error?: { message?: string } | string;
};

function headers(extra: Record<string, string> = {}) {
  const h: Record<string, string> = { authorization: `Bearer ${serverEnv.zgApiKey}`, ...extra };
  if (serverEnv.zgTrustMode) h["X-0G-Provider-Trust-Mode"] = serverEnv.zgTrustMode;
  return h;
}

function friendly(status: number, body: string): UpstreamError {
  let detail = "";
  try {
    const j = JSON.parse(body) as { error?: { message?: string; code?: string } | string };
    detail = typeof j.error === "string" ? j.error : (j.error?.message ?? "");
  } catch {
    /* ignore */
  }
  const msg =
    status === 402
      ? "The AI service balance is empty. Please try again later."
      : status === 401 || status === 403
        ? "The AI service rejected our credentials."
        : status === 429
          ? "The AI service is busy. Please retry in a moment."
          : status === 503
            ? "No AI provider is available right now. Please retry."
            : `The AI service returned an error${detail ? `: ${detail.slice(0, 160)}` : ""}.`;
  return new UpstreamError(msg, status >= 500 || status === 429 ? 502 : status === 402 ? 503 : 502);
}

function contentText(c: RouterChatResponse): string {
  const content = c.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => p.text ?? "").join("");
  return "";
}

export async function routerChat(body: Record<string, unknown>, signal: AbortSignal) {
  const res = await fetch(`${serverEnv.zgBaseUrl}/chat/completions`, {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  if (!res.ok) throw friendly(res.status, text);
  const data = JSON.parse(text) as RouterChatResponse;
  const requestId = data.x_0g_trace?.request_id ?? res.headers.get("x-request-id") ?? data.id;
  if (!requestId) throw new UpstreamError("The AI response had no request ID.", 502);
  return { text: contentText(data), requestId, model: data.model ?? String(body.model) };
}

export async function routerTranscribe(file: Blob, filename: string, signal: AbortSignal) {
  const fd = new FormData();
  fd.append("file", file, filename);
  fd.append("model", serverEnv.zgSttModel);
  fd.append("response_format", "json");
  const res = await fetch(`${serverEnv.zgBaseUrl}/audio/transcriptions`, { method: "POST", headers: headers(), body: fd, signal });
  const text = await res.text();
  if (!res.ok) throw Object.assign(friendly(res.status, text), { upstreamStatus: res.status });
  const data = JSON.parse(text) as { text?: string; id?: string; x_0g_trace?: { request_id?: string } };
  const requestId = data.x_0g_trace?.request_id ?? res.headers.get("x-request-id") ?? data.id;
  if (!requestId) throw new UpstreamError("The transcription had no request ID.", 502);
  return { text: data.text ?? "", requestId, model: serverEnv.zgSttModel };
}

/** Fallback when no speech-to-text model is routable: an audio-capable chat model. */
export async function routerTranscribeViaChat(audio: Uint8Array, format: string, signal: AbortSignal) {
  // The audio-chat provider only accepts the audio as a data URL; raw base64 is
  // rejected with "The provided URL does not appear to be valid".
  const dataUrl = `data:audio/${format};base64,${Buffer.from(audio).toString("base64")}`;
  return routerChat(
    {
      model: serverEnv.zgAudioChatModel,
      max_tokens: 400,
      messages: [
        { role: "system", content: "Transcribe the user's audio verbatim. Output only the transcript text." },
        {
          role: "user",
          content: [{ type: "input_audio", input_audio: { data: dataUrl, format } }],
        },
      ],
    },
    signal,
  );
}

/** Text -> speech (MP3) for reading AI answers aloud. */
export async function routerSpeak(text: string, signal: AbortSignal): Promise<{ audio: ArrayBuffer; requestId: string }> {
  const res = await fetch(`${serverEnv.zgBaseUrl}/audio/speech`, {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify({ model: serverEnv.zgTtsModel, input: text, voice: serverEnv.zgTtsVoice, response_format: "mp3" }),
    signal,
  });
  if (!res.ok) throw friendly(res.status, await res.text());
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("audio/")) throw new UpstreamError("The speech service returned no audio.", 502);
  const requestId = res.headers.get("x-request-id") ?? "";
  return { audio: await res.arrayBuffer(), requestId };
}
