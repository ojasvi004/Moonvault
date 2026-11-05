"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEntries } from "@/components/hooks";
import { Card, Disclaimer, LinkButton, PageTitle, Spinner } from "@/components/ui";
import { computeStats, cycleDays, dayKind, phaseFor, predict } from "@/lib/cycle/cycle";
import { diffDays, formatDate, monthGrid, todayISO } from "@/lib/cycle/dates";
import type { Entry } from "@/lib/types";

const KIND_STYLE: Record<string, string> = {
  period: "bg-rose text-[#2a0d14] font-semibold",
  predicted: "border border-dashed border-rose text-rose",
  fertile: "bg-lav-soft text-lav",
  ovulation: "bg-gold text-[#2a1e05] font-semibold",
};

const PHASE_COPY: Record<string, string> = {
  menstrual: "Menstrual phase",
  follicular: "Follicular phase",
  ovulation: "Around ovulation",
  luteal: "Luteal phase",
};

export default function CalendarPage() {
  const { entries } = useEntries();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }));

  const model = useMemo(() => {
    if (!entries) return null;
    const stats = computeStats(entries);
    const preds = predict(stats, today, 4);
    const byDate = new Map<string, Entry>(entries.map((e) => [e.date, e]));
    const cd = cycleDays([{ date: today } as Entry], stats.periods).get(today);
    return { stats, preds, byDate, cycleDay: cd };
  }, [entries, today]);

  if (!model) return <Spinner label="Decrypting your calendar…" />;
  const { stats, preds, byDate, cycleDay } = model;
  const next = preds.find((p) => p.nextStart >= today) ?? preds[0];
  const daysToNext = next ? diffDays(today, next.nextStart) : null;
  const grid = monthGrid(cursor.y, cursor.m);
  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const todayEntry = byDate.get(today);

  return (
    <div>
      <PageTitle eyebrow={formatDate(today, { weekday: "long", day: "numeric", month: "long" })} title={cycleDay ? `Cycle day ${cycleDay}` : "Welcome to your vault"} sub={cycleDay ? PHASE_COPY[phaseFor(cycleDay, stats.avgCycle, stats.avgPeriod)] : "Log your period days to see predictions."} />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <button className="rounded-full border border-line px-3 py-1.5 text-sm" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))} aria-label="Previous month">
              ‹
            </button>
            <h2 className="font-display text-xl">{monthLabel}</h2>
            <button className="rounded-full border border-line px-3 py-1.5 text-sm" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-faint">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d) => {
              const inMonth = +d.slice(5, 7) - 1 === cursor.m;
              const kind = dayKind(d, byDate, preds);
              const e = byDate.get(d);
              const isToday = d === today;
              const future = d > today;
              const cell = (
                <span
                  className={`relative flex aspect-square items-center justify-center rounded-full text-sm transition ${kind ? KIND_STYLE[kind] : "text-text"} ${inMonth ? "" : "opacity-30"} ${isToday ? "ring-2 ring-accent ring-offset-2 ring-offset-[#1a1530]" : ""}`}
                >
                  {+d.slice(8)}
                  {e && (e.symptoms.length > 0 || e.mood) && kind !== "period" && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />}
                </span>
              );
              return future ? (
                <div key={d} className="p-0.5" aria-label={`${d}${kind ? ` ${kind}` : ""}`}>
                  {cell}
                </div>
              ) : (
                <Link key={d} href={`/log?date=${d}`} className="p-0.5 hover:opacity-80" aria-label={`Log ${d}${kind ? `, ${kind}` : ""}`}>
                  {cell}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose" /> Period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-dashed border-rose" /> Predicted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-lav-soft ring-1 ring-lav/40" /> Fertile window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-gold" /> Ovulation (est.)
            </span>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <p className="text-sm text-muted">Next period</p>
            {next ? (
              <>
                <p className="font-display mt-1 text-4xl">{daysToNext! > 0 ? `in ${daysToNext} days` : daysToNext === 0 ? "today" : `${-daysToNext!} days late`}</p>
                <p className="mt-1 text-muted">Around {formatDate(next.nextStart, { weekday: "short", day: "numeric", month: "short" })}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-lav-soft p-3">
                    <p className="text-xs text-lav">Fertile window</p>
                    <p>
                      {formatDate(next.fertileStart)} – {formatDate(next.fertileEnd)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gold/15 p-3">
                    <p className="text-xs text-gold">Ovulation (est.)</p>
                    <p>{formatDate(next.ovulation)}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="font-display mt-1 text-2xl">Log a period to begin</p>
            )}
            <p className="mt-4 text-xs text-muted">
              <span className={`mr-1 rounded-full px-2 py-0.5 ${stats.confidence === "high" ? "bg-ok/15 text-ok" : stats.confidence === "medium" ? "bg-warn/15 text-warn" : "bg-card-2 text-muted"}`}>
                {stats.confidence} confidence
              </span>
              {stats.confidenceNote}
            </p>
            <div className="mt-2">
              <Disclaimer />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">Today</p>
              <LinkButton href="/log" variant={todayEntry ? "ghost" : "primary"}>
                {todayEntry ? "Edit" : "Log today"}
              </LinkButton>
            </div>
            {todayEntry ? (
              <ul className="mt-3 space-y-1 text-sm">
                <li>
                  Flow: <span className="capitalize">{todayEntry.flow}</span>
                </li>
                {todayEntry.symptoms.length > 0 && <li>Symptoms: {todayEntry.symptoms.join(", ")}</li>}
                {todayEntry.mood && <li className="capitalize">Mood: {todayEntry.mood}</li>}
                {todayEntry.sleepHours != null && <li>Sleep: {todayEntry.sleepHours} h</li>}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Nothing logged yet today. It takes ten seconds — or just say it out loud.</p>
            )}
          </Card>

          <Card className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-display text-2xl">{stats.avgCycle}</p>
              <p className="text-xs text-muted">avg cycle (days)</p>
            </div>
            <div>
              <p className="font-display text-2xl">{stats.avgPeriod}</p>
              <p className="text-xs text-muted">avg period (days)</p>
            </div>
            <div>
              <p className="font-display text-2xl">{stats.cyclesTracked ? `±${stats.variability}` : "—"}</p>
              <p className="text-xs text-muted">variability</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
