"use client";
import { useEffect, useRef, useState } from "react";
import { structureTranscript, transcribe, saveAiResult } from "@/lib/ai/run";
import type { StructuredLog } from "@/lib/ai/schema";
import { Button, ErrorBox, Spinner, errMsg } from "./ui";

const MAX_SECONDS = 45;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

export type VoiceResult = { log: StructuredLog; transcript: string; requestIds: string[]; mock?: boolean };

/** Record up to 45 s, transcribe and structure it with private AI. The caller shows the result for confirmation. */
export function VoiceRecorder({ today, onResult }: { today: string; onResult: (r: VoiceResult) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [secs, setSecs] = useState(0);
  const [stage, setStage] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function process(blob: Blob) {
    setState("working");
    setErr(null);
    try {
      setStage("Transcribing privately…");
      const t = await transcribe(blob);
      if (!t.text.trim()) throw new Error("We couldn't hear anything. Try again a little closer to the mic.");
      setStage("Turning it into a log…");
      const { log, res } = await structureTranscript(t.text, today);
      const requestIds = [t.requestId, res.requestId];
      await saveAiResult({ kind: "voice", question: t.text, answer: JSON.stringify(log), requestIds, model: res.model, mock: res.mock });
      onResult({ log, transcript: t.text, requestIds, mock: res.mock || t.mock });
      setState("idle");
    } catch (e) {
      setErr(errMsg(e));
      setState("idle");
    }
  }

  async function start() {
    setErr(null);
    const mimeType = pickMime();
    if (!navigator.mediaDevices?.getUserMedia || mimeType === undefined) {
      setErr("Voice recording isn't supported in this browser. You can type your log instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, noiseSuppression: true, echoCancellation: true } });
      const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24_000 });
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        const blob = new Blob(chunks.current, { type: mimeType.split(";")[0] });
        setLastBlob(blob);
        void process(blob);
      };
      recRef.current = rec;
      rec.start(1000);
      setSecs(0);
      setState("recording");
      timer.current = setInterval(() => {
        setSecs((s) => {
          if (s + 1 >= MAX_SECONDS && rec.state === "recording") rec.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setErr("Microphone access was blocked. Allow it in your browser settings, or type your log instead.");
    }
  }

  function stop() {
    if (recRef.current?.state === "recording") recRef.current.stop();
  }

  return (
    <div className="rounded-2xl border border-line bg-card-2/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Speak your log</p>
          <p className="text-xs text-muted">e.g. &ldquo;Medium flow, cramps and a headache, slept six hours, feeling low.&rdquo; Up to {MAX_SECONDS}s.</p>
        </div>
        {state === "recording" ? (
          <Button variant="danger" onClick={stop}>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" /> Stop · {MAX_SECONDS - secs}s
          </Button>
        ) : (
          <Button variant="soft" onClick={start} disabled={state === "working"}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            Record
          </Button>
        )}
      </div>
      {state === "working" && (
        <div className="mt-3">
          <Spinner small label={stage} />
        </div>
      )}
      {err && (
        <div className="mt-3">
          <ErrorBox message={err} onRetry={lastBlob ? () => void process(lastBlob) : undefined} />
        </div>
      )}
    </div>
  );
}
