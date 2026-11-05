"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { useEntries } from "@/components/hooks";
import { Card, Disclaimer, LinkButton, PageTitle, Spinner } from "@/components/ui";
import { computeStats } from "@/lib/cycle/cycle";
import { formatDate } from "@/lib/cycle/dates";

const loading = () => <div className="flex h-48 items-center justify-center"><Spinner small /></div>;
const CycleLengthChart = dynamic(() => import("@/components/HistoryCharts").then((m) => m.CycleLengthChart), { ssr: false, loading });
const SymptomChart = dynamic(() => import("@/components/HistoryCharts").then((m) => m.SymptomChart), { ssr: false, loading });
const SleepChart = dynamic(() => import("@/components/HistoryCharts").then((m) => m.SleepChart), { ssr: false, loading });

export default function HistoryPage() {
  const { entries } = useEntries();

  const model = useMemo(() => {
    if (!entries) return null;
    const stats = computeStats(entries);
    const cycles = stats.periods.slice(1).map((p, i) => ({ label: formatDate(stats.periods[i].start, { month: "short" }), days: stats.cycleLengths[i] })).slice(-12);
    const counts = new Map<string, number>();
    for (const e of entries) for (const s of e.symptoms) counts.set(s, (counts.get(s) ?? 0) + 1);
    const symptoms = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    const sleep = entries.filter((e) => e.sleepHours != null).slice(-45).map((e) => ({ label: formatDate(e.date), hours: e.sleepHours! }));
    return { stats, cycles, symptoms, sleep };
  }, [entries]);

  if (!entries || !model) return <Spinner label="Decrypting your history…" />;

  if (entries.length === 0) {
    return (
      <div>
        <PageTitle eyebrow="History" title="Your story starts here" sub="Once you log a few days, your trends and cycle history will appear here." />
        <LinkButton href="/log">Log your first day</LinkButton>
      </div>
    );
  }

  const { stats, cycles, symptoms, sleep } = model;

  return (
    <div>
      <PageTitle eyebrow="History" title="Trends over time" sub={`${entries.length} days logged · ${stats.periods.length} periods`} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl">Cycle length</h2>
          <p className="mb-3 text-sm text-muted">Days from one period start to the next.</p>
          {cycles.length ? <CycleLengthChart data={cycles} avg={stats.avgCycle} /> : <p className="text-sm text-muted">Log at least two periods to see this.</p>}
          <p className="mt-2 text-xs text-muted">
            Shortest {stats.shortest ?? "—"} · longest {stats.longest ?? "—"} · variability ±{stats.variability} days
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-xl">Most common symptoms</h2>
          <p className="mb-3 text-sm text-muted">Number of days each symptom was logged.</p>
          {symptoms.length ? <SymptomChart data={symptoms} /> : <p className="text-sm text-muted">No symptoms logged yet.</p>}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-display text-xl">Sleep</h2>
          <p className="mb-3 text-sm text-muted">Hours per night, last {sleep.length} logged nights.</p>
          {sleep.length > 1 ? <SleepChart data={sleep} /> : <p className="text-sm text-muted">Log sleep on a few days to see a trend.</p>}
        </Card>
      </div>

      <h2 className="font-display mb-3 mt-10 text-2xl">All entries</h2>
      <Card className="overflow-x-auto p-0 sm:p-0">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs text-faint">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Flow</th>
              <th className="px-4 py-3 font-medium">Symptoms</th>
              <th className="px-4 py-3 font-medium">Mood</th>
              <th className="px-4 py-3 font-medium">Sleep</th>
            </tr>
          </thead>
          <tbody>
            {[...entries].reverse().slice(0, 120).map((e) => (
              <tr key={e.id} className="border-b border-line/50 last:border-0 hover:bg-card-2/50">
                <td className="px-4 py-2.5">
                  <Link className="hover:text-accent" href={`/log?date=${e.date}`}>
                    {formatDate(e.date, { day: "numeric", month: "short", year: "numeric" })}
                  </Link>
                </td>
                <td className="px-4 py-2.5 capitalize">{e.flow === "none" ? "—" : e.flow}</td>
                <td className="px-4 py-2.5 text-muted">{[...e.symptoms, e.symptomsText].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-2.5 capitalize">{e.mood ?? "—"}</td>
                <td className="px-4 py-2.5">{e.sleepHours != null ? `${e.sleepHours} h` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-4">
        <Disclaimer />
      </div>
    </div>
  );
}
