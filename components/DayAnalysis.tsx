"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRecords } from "@/components/hooks";
import { SpeakButton } from "@/components/SpeakButton";
import { useAiCall } from "@/components/useAiCall";
import { Button, Card, ErrorBox, Spinner, VerificationId, timeAgo } from "@/components/ui";
import { dayInput } from "@/lib/ai/inputs";
import type { DayInfo } from "@/lib/cycle/cycle";
import { formatDate } from "@/lib/cycle/dates";
import type { Entry } from "@/lib/types";

const LABELS: Record<string, { title: string; cls: string }> = {
  summary: { title: "Where you are", cls: "" },
  "your pattern": { title: "Your pattern", cls: "rounded-xl bg-lav-soft p-3" },
  logged: { title: "Logged", cls: "" },
  "watch for": { title: "Watch for", cls: "rounded-xl bg-accent/10 p-3" },
};

function parse(text: string) {
  const out: { label?: string; text: string }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/\*\*/g, "").replace(/^[-•*]\s*/, "");
    if (!line) continue;
    const m = /^(summary|your pattern|logged|watch for)\s*:\s*(.*)$/i.exec(line);
    if (m) out.push({ label: m[1].toLowerCase(), text: m[2] });
    else if (out.length) out[out.length - 1].text += ` ${line}`;
    else out.push({ text: line });
  }
  return out;
}

/** Private AI analysis of one calendar day, cached in the encrypted vault per day + data version. */
export function DayAnalysis({
  entries,
  date,
  info,
  overrides,
}: {
  entries: Entry[];
  date: string;
  info: DayInfo | null;
  overrides: { avgCycle: number; avgPeriod: number };
}) {
  const { data: history } = useRecords("ai");
  const call = useAiCall("day", "day");
  const { run, state } = call;
  const entry = entries.find((e) => e.date === date);
  // Re-analyse when this day's log changes or a new period shifts the cycle.
  const periodsKey = entries.filter((e) => e.flow !== "none").length;
  const key = `day:${date}:${entry?.updatedAt ?? 0}:${periodsKey}:${overrides.avgCycle}`;
  const tried = useRef(new Set<string>());

  const cached = useMemo(
    () => (history ?? []).filter((h) => h.kind === "day" && h.question === key).sort((a, b) => b.createdAt - a.createdAt)[0],
    [history, key],
  );

  // The current run's result belongs to this key only if it was started for it.
  const [runKey, setRunKey] = useState<string | null>(null);

  useEffect(() => {
    if (!info || history === null || cached || tried.current.has(key)) return;
    // Debounce so clicking through days doesn't fire a request per click.
    const t = setTimeout(() => {
      tried.current.add(key);
      setRunKey(key);
      void run(dayInput(entries, date, overrides), key);
    }, 650);
    return () => clearTimeout(t);
  }, [info, history, cached, key, entries, date, overrides, run]);

  const mine = runKey === key;
  const fresh = state.status === "done" && mine ? state.res : null;
  // Saved results show up in `cached` right after a run; `fresh` covers the gap.
  const shown = cached
    ? { text: cached.answer, ids: cached.requestIds, mock: cached.mock, at: cached.createdAt as number | undefined }
    : fresh
      ? { text: fresh.text, ids: [fresh.requestId], mock: fresh.mock, at: undefined }
      : null;
  const loading = state.status === "loading" && mine;
  const error = state.status === "error" && mine ? state.message : null;

  return (
    <Card className="comic-sm !rounded-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <span>✦</span> Private AI · day analysis
          </p>
          <h3 className="font-display mt-1 text-xl">{formatDate(date, { weekday: "short", day: "numeric", month: "short" })}</h3>
          {shown && !loading && <p className="text-xs text-faint">Analysed {shown.at ? timeAgo(shown.at) : "just now"} on 0G Private Computer</p>}
        </div>
        {info && (
          <div className="flex items-center gap-2">
            {shown && !loading && <SpeakButton text={shown.text} />}
            <Button
              variant="soft"
              className="min-h-9 px-3 py-1.5 text-xs"
              loading={loading}
              onClick={() => {
                setRunKey(key);
                void run(dayInput(entries, date, overrides), key);
              }}
            >
              {shown ? "Refresh" : "Analyse"}
            </Button>
          </div>
        )}
      </div>

      {!info ? (
        <p className="mt-3 text-sm text-muted">Log a period first. Day analysis needs to know where this day sits in your cycle.</p>
      ) : loading ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <Spinner small label="Reading your history for this point in the cycle…" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-card-2" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-card-2" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-card-2" />
        </div>
      ) : error ? (
        <div className="mt-4">
          <ErrorBox message={error} onRetry={call.retry} />
        </div>
      ) : shown ? (
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          {parse(shown.text).map((p, i) => {
            const meta = p.label ? LABELS[p.label] : undefined;
            return (
              <div key={i} className={meta?.cls}>
                {meta && <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{meta.title}</p>}
                <p className={meta ? "mt-0.5" : ""}>{p.text}</p>
              </div>
            );
          })}
          <VerificationId ids={shown.ids} mock={shown.mock} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-faint">Preparing analysis…</p>
      )}
      <p className="mt-3 text-[11px] text-faint">Only an anonymized excerpt (no dates or names) is sent. Informational, not medical advice.</p>
    </Card>
  );
}
