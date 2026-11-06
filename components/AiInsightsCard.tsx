"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRecords } from "@/components/hooks";
import { HistoricalCycleDialog } from "@/components/HistoricalCycleDialog";
import { useAiCall } from "@/components/useAiCall";
import { AiText } from "@/components/AiText";
import { SpeakButton } from "@/components/SpeakButton";
import { Button, Card, ErrorBox, Spinner, VerificationId, timeAgo } from "@/components/ui";
import { insightsInput } from "@/lib/ai/inputs";
import type { Entry } from "@/lib/types";
import { PROFILE_RECORD_ID } from "@/lib/vault/healthProfile";

export const MIN_ENTRIES_FOR_INSIGHTS = 3;
const STALE_MS = 24 * 3600_000;

// One automatic refresh per data version per session, so a failing service
// or quick page switches never cause repeated AI calls.
const autoTried = new Set<string>();

/**
 * AI Insights: patterns by cycle phase plus what to expect this week.
 * Generated automatically when there is new data (at most once a day otherwise)
 * and saved, with its Verification ID, in the encrypted vault.
 */
export function AiInsightsCard({ entries, className = "", showAskLink = true }: { entries: Entry[]; className?: string; showAskLink?: boolean }) {
  const { data: history } = useRecords("ai");
  const call = useAiCall("insights", "insights");
  const run = call.run;
  const started = useRef(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

  const latest = useMemo(
    () => (history ?? []).filter((h) => h.kind === "insights" && h.id !== PROFILE_RECORD_ID).sort((a, b) => b.createdAt - a.createdAt)[0],
    [history],
  );
  const lastChange = useMemo(() => entries.reduce((m, e) => Math.max(m, e.updatedAt ?? 0), 0), [entries]);
  const enough = entries.length >= MIN_ENTRIES_FOR_INSIGHTS;

  useEffect(() => {
    if (!enough || history === null || started.current) return;
    const stale = !latest || Date.now() - latest.createdAt > STALE_MS || lastChange > latest.createdAt;
    const key = `${entries.length}:${lastChange}`;
    if (!stale || autoTried.has(key)) return;
    autoTried.add(key);
    started.current = true;
    void run(insightsInput(entries));
  }, [enough, history, latest, lastChange, entries, run]);

  const shown =
    call.state.status === "done"
      ? { text: call.state.res.text, ids: [call.state.res.requestId], mock: call.state.res.mock, at: undefined as number | undefined }
      : latest
        ? { text: latest.answer, ids: latest.requestIds, mock: latest.mock, at: latest.createdAt }
        : null;
  const loading = call.state.status === "loading";

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">AI Insights</p>
          <h2 className="font-display mt-1 text-2xl">Your patterns</h2>
          {shown && !loading && <p className="mt-0.5 text-xs text-faint">Updated {shown.at ? timeAgo(shown.at) : "just now"}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => setHistoryDialogOpen(true)}>
            Add past cycles
          </Button>
          {enough && (
            <>
              {shown && !loading && <SpeakButton text={shown.text} />}
              <Button variant="soft" className="min-h-9 px-3 py-1.5 text-xs" loading={loading} onClick={() => void call.run(insightsInput(entries))}>
                Refresh
              </Button>
            </>
          )}
        </div>
      </div>

      {!enough ? (
        <div className="mt-4">
          <p className="text-sm text-muted">
            Log {MIN_ENTRIES_FOR_INSIGHTS - entries.length} more day{MIN_ENTRIES_FOR_INSIGHTS - entries.length === 1 ? "" : "s"} and private AI will start spotting patterns in your
            symptoms, mood and sleep across your cycle.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-card-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(entries.length / MIN_ENTRIES_FOR_INSIGHTS) * 100}%` }} />
          </div>
        </div>
      ) : (
        <>
          {loading && (
            <div className="mt-4 rounded-2xl bg-card-2/60 p-4">
              <Spinner small label={shown ? "Updating with your latest entries…" : "Looking for patterns privately…"} />
            </div>
          )}
          {call.state.status === "error" && (
            <div className="mt-4">
              <ErrorBox message={call.state.message} onRetry={call.retry} />
            </div>
          )}
          {shown && !loading && (
            <div className="mt-4">
              <AiText text={shown.text} />
              <VerificationId ids={shown.ids} mock={shown.mock} />
            </div>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        {showAskLink && enough && (
          <Link href="/ask" className="text-sm text-accent hover:underline">
            Ask a question →
          </Link>
        )}
      </div>
      <HistoricalCycleDialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} />
    </Card>
  );
}
