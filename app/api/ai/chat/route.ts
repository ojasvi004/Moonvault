// Proxy to 0G Private Computer for Moonvault's fixed AI tasks only.
// Input is the already-anonymized excerpt built in the browser. Nothing is logged or stored.
import { buildMessages, MAX_INPUT_BYTES } from "@/lib/ai/prompts";
import type { AiTask } from "@/lib/adapters/types";
import { serverEnv } from "@/lib/server/env";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";
import { routerChat, UpstreamError } from "@/lib/server/zerog";

export const maxDuration = 60;

const TASKS: AiTask[] = ["ask", "insights", "summary", "structure"];

export async function POST(req: Request) {
  const rl = rateLimit(`ai:${clientIp(req)}`, 30, 10 * 60_000);
  if (!rl.ok) return limited(rl.retryAfter);
  if (!serverEnv.zgApiKey) return json({ error: "AI is not configured on this server (missing 0G API key)." }, 503);

  const raw = await req.text();
  if (raw.length > MAX_INPUT_BYTES) return json({ error: "Too much data for one request." }, 413);
  let body: { task?: AiTask; input?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!body.task || !TASKS.includes(body.task) || typeof body.input !== "object" || !body.input) {
    return json({ error: "Unknown task" }, 400);
  }

  const { messages, maxTokens } = buildMessages(body.task, body.input);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28_000);
  try {
    const out = await routerChat({ model: serverEnv.zgChatModel, messages, max_tokens: maxTokens, temperature: body.task === "structure" ? 0 : 0.4 }, ctrl.signal);
    if (!out.text.trim()) return json({ error: "The AI returned an empty answer. Please retry." }, 502);
    return json(out);
  } catch (e) {
    if (ctrl.signal.aborted) return json({ error: "The AI took too long. Please retry." }, 504);
    if (e instanceof UpstreamError) return json({ error: e.message }, e.status);
    return json({ error: "Could not reach the AI service." }, 502);
  } finally {
    clearTimeout(timer);
  }
}
