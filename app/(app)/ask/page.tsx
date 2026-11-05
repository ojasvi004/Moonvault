"use client";
import { useMemo, useState } from "react";
import { useEntries, useRecords } from "@/components/hooks";
import { useAiCall } from "@/components/useAiCall";
import { Button, Card, Disclaimer, ErrorBox, LinkButton, PageTitle, Spinner, VerificationId, errMsg, timeAgo } from "@/components/ui";
import { askInput, insightsInput, summaryInput } from "@/lib/ai/inputs";
import { buildSummaryPdf } from "@/lib/ai/pdf";
import { computeStats } from "@/lib/cycle/cycle";
import { todayISO } from "@/lib/cycle/dates";

const SUGGESTIONS = ["When do my cramps usually start?", "Is my cycle getting longer?", "How does my sleep change before my period?", "What should I mention to my doctor?"];

function AiText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[0.95rem] leading-relaxed">
      {text.split("\n").filter((l) => l.trim()).map((l, i) => {
        const t = l.trim().replace(/\*\*/g, "");
        if (/^[-•*]\s/.test(t)) return <p key={i} className="flex gap-2"><span className="text-accent">•</span><span>{t.replace(/^[-•*]\s/, "")}</span></p>;
        if (/^tip:/i.test(t)) return <p key={i} className="mt-2 rounded-xl bg-accent/10 p-3 text-sm">{t}</p>;
        if (t.length < 40 && !/[.!?]$/.test(t)) return <p key={i} className="font-display mt-3 text-lg">{t.replace(/^#+\s*/, "")}</p>;
        return <p key={i}>{t}</p>;
      })}
    </div>
  );
}

function Working({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-card-2/60 p-4">
      <Spinner small label={label} />
    </div>
  );
}

export default function AskPage() {
  const { entries } = useEntries();
  const { data: history } = useRecords("ai");
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const ask = useAiCall("ask", "ask");
  const insights = useAiCall("insights", "insights");
  const summary = useAiCall("summary", "summary");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const stats = useMemo(() => (entries ? computeStats(entries) : null), [entries]);

  if (!entries || !stats) return <Spinner label="Decrypting…" />;

  if (entries.length < 3) {
    return (
      <div>
        <PageTitle eyebrow="Private AI" title="Insights need a little data" sub="Log at least a few days (ideally one full period) and come back for patterns, answers and a doctor summary." />
        <LinkButton href="/log">Log a day</LinkButton>
      </div>
    );
  }

  async function downloadPdf() {
    if (summary.state.status !== "done") return;
    setPdfErr(null);
    setPdfBusy(true);
    try {
      const blob = await buildSummaryPdf(entries!, summary.state.res.text, [summary.state.res.requestId]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cycle-summary-${todayISO()}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setPdfErr(errMsg(e));
    } finally {
      setPdfBusy(false);
    }
  }

  const recent = (history ?? []).filter((h) => h.kind !== "voice").sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <div>
      <PageTitle
        eyebrow="Private AI"
        title="Understand your cycle"
        sub="Only the entries needed for each request are decrypted, stripped of names and dates, and processed on private compute. Nothing is kept there."
      />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <h2 className="font-display text-2xl">Ask your cycle</h2>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!q.trim()) return;
              setAsked(q.trim());
              void ask.run(askInput(entries, q.trim()), q.trim());
            }}
          >
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your patterns…" maxLength={300} />
            <Button type="submit" loading={ask.state.status === "loading"} disabled={!q.trim()} className="shrink-0">
              Ask
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip text-xs" onClick={() => setQ(s)}>
                {s}
              </button>
            ))}
          </div>
          {ask.state.status === "loading" && <Working label="Thinking privately… (up to 30s)" />}
          {ask.state.status === "error" && (
            <div className="mt-4">
              <ErrorBox message={ask.state.message} onRetry={ask.retry} />
            </div>
          )}
          {ask.state.status === "done" && (
            <div className="mt-5 rounded-2xl border border-line bg-bg-2/60 p-4">
              <p className="mb-2 text-sm text-muted">&ldquo;{asked}&rdquo;</p>
              <AiText text={ask.state.res.text} />
              <VerificationId ids={[ask.state.res.requestId]} mock={ask.state.res.mock} />
            </div>
          )}
          <div className="mt-4">
            <Disclaimer />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-2xl">Pattern insights</h2>
          <p className="mt-1 text-sm text-muted">
            Computed on your device: {stats.avgCycle}-day average cycle, {stats.avgPeriod}-day periods, ±{stats.variability} days variability. AI then explains recurring patterns by cycle phase.
          </p>
          <Button className="mt-4" variant="soft" onClick={() => void insights.run(insightsInput(entries))} loading={insights.state.status === "loading"}>
            {insights.state.status === "done" ? "Refresh insights" : "Find my patterns"}
          </Button>
          {insights.state.status === "loading" && <Working label="Looking for patterns…" />}
          {insights.state.status === "error" && (
            <div className="mt-4">
              <ErrorBox message={insights.state.message} onRetry={insights.retry} />
            </div>
          )}
          {insights.state.status === "done" && (
            <div className="mt-4">
              <AiText text={insights.state.res.text} />
              <VerificationId ids={[insights.state.res.requestId]} mock={insights.state.res.mock} />
            </div>
          )}
          <div className="mt-4">
            <Disclaimer />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-2xl">Doctor summary</h2>
              <p className="mt-1 max-w-xl text-sm text-muted">A one-page PDF of the last 6 months: key numbers, period dates, symptoms, mood and sleep, plus questions to ask. The PDF is built on your device.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => void summary.run(summaryInput(entries))} loading={summary.state.status === "loading"}>
                {summary.state.status === "done" ? "Regenerate" : "Write summary"}
              </Button>
              {summary.state.status === "done" && (
                <Button onClick={() => void downloadPdf()} loading={pdfBusy}>
                  Download PDF
                </Button>
              )}
            </div>
          </div>
          {summary.state.status === "loading" && <Working label="Writing your summary…" />}
          {summary.state.status === "error" && (
            <div className="mt-4">
              <ErrorBox message={summary.state.message} onRetry={summary.retry} />
            </div>
          )}
          {pdfErr && (
            <div className="mt-4">
              <ErrorBox message={`Couldn't build the PDF: ${pdfErr}`} onRetry={() => void downloadPdf()} />
            </div>
          )}
          {summary.state.status === "done" && (
            <div className="mt-5 rounded-2xl border border-line bg-bg-2/60 p-4">
              <AiText text={summary.state.res.text} />
              <VerificationId ids={[summary.state.res.requestId]} mock={summary.state.res.mock} />
            </div>
          )}
          <div className="mt-4">
            <Disclaimer />
          </div>
        </Card>
      </div>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display mb-3 text-2xl">Recent answers</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {recent.map((r) => (
              <Card key={r.id} className="p-4 sm:p-5">
                <p className="text-xs uppercase tracking-wider text-faint">
                  {r.kind === "ask" ? "Question" : r.kind === "insights" ? "Insights" : "Summary"} · {timeAgo(r.createdAt)}
                </p>
                {r.question && <p className="mt-1 text-sm text-muted">&ldquo;{r.question}&rdquo;</p>}
                <p className="mt-2 line-clamp-4 text-sm">{r.answer}</p>
                <VerificationId ids={r.requestIds} mock={r.mock} />
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
