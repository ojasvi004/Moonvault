"use client";
import { useEffect, useRef, useState } from "react";
import { MOCK_SERVICES } from "@/lib/config";

/** Strip the light markdown our AI answers use so it reads naturally. */
function speakable(text: string): string {
  return text
    .replace(/\*\*|__|`|#+\s*/g, "")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/\[demo[^\]]*\]\s*/gi, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\.\s*\./g, ".")
    .trim()
    .slice(0, 1500);
}

function browserVoiceAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/**
 * "Listen" button for AI answers. Uses 0G private text-to-speech; if that is
 * unavailable (demo mode, outage), it falls back to the browser's own voice.
 */
export function SpeakButton({ text, className = "" }: { text: string; className?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [err, setErr] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  function cleanup() {
    ctrl.current?.abort();
    ctrl.current = null;
    if (audio.current) {
      audio.current.onended = audio.current.onerror = null;
      audio.current.pause();
      audio.current.src = "";
      audio.current = null;
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    if (browserVoiceAvailable()) window.speechSynthesis.cancel();
  }

  useEffect(() => cleanup, []);

  function speakInBrowser(t: string): boolean {
    if (!browserVoiceAvailable()) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.rate = 1;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    window.speechSynthesis.speak(u);
    setState("playing");
    return true;
  }

  async function play() {
    setErr(null);
    const t = speakable(text);
    if (!t) return;
    if (MOCK_SERVICES) {
      if (!speakInBrowser(t)) setErr("Read-aloud isn't supported in this browser.");
      return;
    }
    setState("loading");
    ctrl.current = new AbortController();
    try {
      const res = await fetch("/api/ai/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t }),
        signal: ctrl.current.signal,
      });
      if (!res.ok) throw new Error(`speak ${res.status}`);
      const blob = await res.blob();
      url.current = URL.createObjectURL(blob);
      const a = new Audio(url.current);
      audio.current = a;
      a.onended = () => {
        setState("idle");
        cleanup();
      };
      a.onerror = () => {
        cleanup();
        if (!speakInBrowser(t)) setState("idle");
      };
      await a.play();
      setState("playing");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return setState("idle");
      cleanup();
      if (!speakInBrowser(t)) {
        setState("idle");
        setErr("Couldn't read this aloud. Please try again.");
      }
    }
  }

  function stop() {
    cleanup();
    setState("idle");
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => (state === "idle" ? void play() : stop())}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-text"
        aria-label={state === "idle" ? "Read this answer aloud" : "Stop reading"}
      >
        {state === "loading" ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {state === "playing" ? <rect x="6" y="6" width="12" height="12" rx="1" /> : <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />}
          </svg>
        )}
        {state === "playing" ? "Stop" : state === "loading" ? "Loading…" : "Listen"}
      </button>
      {err && <span className="text-xs text-bad">{err}</span>}
    </span>
  );
}
