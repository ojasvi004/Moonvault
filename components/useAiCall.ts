"use client";
import { useCallback, useRef, useState } from "react";
import type { AiResponse, AiTask } from "@/lib/adapters";
import { runAi, saveAiResult } from "@/lib/ai/run";
import type { AiKind } from "@/lib/types";
import { errMsg } from "./ui";

export type AiCallState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; res: AiResponse };

/** One AI action with spinner, timeout (in runAi), retry and persistence of the result + request ID. */
export function useAiCall(task: AiTask, kind: AiKind) {
  const [state, setState] = useState<AiCallState>({ status: "idle" });
  const last = useRef<{ input: unknown; question?: string } | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(
    async (input: unknown, question?: string) => {
      last.current = { input, question };
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setState({ status: "loading" });
      try {
        const res = await runAi(task, input, ctrl.current.signal);
        await saveAiResult({ kind, question, answer: res.text, requestIds: [res.requestId], model: res.model, mock: res.mock });
        setState({ status: "done", res });
        return res;
      } catch (e) {
        if (ctrl.current?.signal.aborted && !(e instanceof Error && e.name === "TimeoutError")) return;
        setState({ status: "error", message: errMsg(e) });
      }
    },
    [task, kind],
  );

  const retry = useCallback(() => {
    if (last.current) void run(last.current.input, last.current.question);
  }, [run]);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, run, retry, cancel };
}
