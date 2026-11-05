// Client-side AI helpers: timeout, structured output, and saving results
// (with their request IDs) into the encrypted local store.
import { getAi, type AiResponse, type AiTask } from "@/lib/adapters";
import { AI_TIMEOUT_MS } from "@/lib/config";
import type { AiResult } from "@/lib/types";
import { withTimeout } from "@/lib/util/retry";
import { putRecord } from "@/lib/vault/records";
import { newId } from "@/lib/vault/entries";
import { parseStructured, type StructuredLog } from "./schema";

export function runAi(task: AiTask, input: unknown, outer?: AbortSignal): Promise<AiResponse> {
  return withTimeout((signal) => getAi().run(task, input, signal), AI_TIMEOUT_MS, outer);
}

export function transcribe(audio: Blob, outer?: AbortSignal): Promise<AiResponse> {
  return withTimeout((signal) => getAi().transcribe(audio, signal), AI_TIMEOUT_MS, outer);
}

export async function structureTranscript(transcript: string, today: string): Promise<{ log: StructuredLog; res: AiResponse }> {
  const res = await runAi("structure", { transcript, today });
  return { log: parseStructured(res.text), res };
}

export async function saveAiResult(r: Omit<AiResult, "id" | "createdAt">): Promise<AiResult> {
  const full: AiResult = { ...r, id: newId(), createdAt: Date.now() };
  await putRecord("ai", full.id, full);
  return full;
}
