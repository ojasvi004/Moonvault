"use client";
import { useEffect, useMemo, useState } from "react";
import { AiInsightsCard } from "@/components/AiInsightsCard";
import { useEntries } from "@/components/hooks";
import { Card, Disclaimer, LinkButton, PageTitle, Spinner } from "@/components/ui";
import { computeStats, cycleDays, dayKind, phaseFor, predict, type Phase } from "@/lib/cycle/cycle";
import { diffDays, formatDate, monthGrid, todayISO } from "@/lib/cycle/dates";
import { getHealthProfile, type HealthProfile } from "@/lib/vault/healthProfile";
import type { Entry } from "@/lib/types";

const PHASE_COPY: Record<Phase, string> = {
  menstrual: "Menstrual phase",
  follicular: "Follicular phase",
  ovulation: "Ovulation window",
  luteal: "Luteal phase",
};

const PHASE_COLORS: Record<Phase, { bg: string; text: string; border: string }> = {
  menstrual: { bg: "bg-rose/15", text: "text-rose", border: "border-rose/30" },
  follicular: { bg: "bg-accent/15", text: "text-accent", border: "border-accent/30" },
  ovulation: { bg: "bg-gold/20", text: "text-gold", border: "border-gold/40" },
  luteal: { bg: "bg-lav/15", text: "text-lav", border: "border-lav/30" },
};

const PHASE_INSIGHTS: Record<Phase, { summary: string; hormones: string; tips: string }> = {
  menstrual: {
    summary: "Your uterine lining is shedding. Physical energy may naturally dip as estrogen and progesterone sit at baseline levels.",
    hormones: "Low estrogen & low progesterone. Energy focus: restorative.",
    tips: "Prioritize warm, iron-dense foods, magnesium, and gentle walks or stretching.",
  },
  follicular: {
    summary: "Follicles are maturing in the ovaries. Rising estrogen stimulates serotonin, bringing a noticeable surge in stamina, focus, and optimism.",
    hormones: "Estrogen steadily climbing. Energy focus: high endurance & creativity.",
    tips: "Ideal phase for high-intensity training, initiating new projects, and social collaboration.",
  },
  ovulation: {
    summary: "A surge in luteinizing hormone (LH) triggers the release of an egg. Estrogen and testosterone reach their monthly zenith.",
    hormones: "Peak estrogen & testosterone spike. Energy focus: peak communication & confidence.",
    tips: "Your fertile window is at its highest. Basal body temperature slightly elevates. Stay hydrated.",
  },
  luteal: {
    summary: "Progesterone becomes the dominant hormone, preparing the body. Metabolism increases while sensory sensitivity and internal focus heighten.",
    hormones: "High progesterone, tapering estrogen. Energy focus: calming, organizing & grounding.",
    tips: "Support mood with complex carbs, limit excess caffeine, and schedule restful evenings.",
  },
};

export default function CalendarPage() {
  const { entries } = useEntries();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }));
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);

  useEffect(() => {
    void getHealthProfile().then(setHealthProfile);
  }, []);

  const model = useMemo(() => {
    if (!entries) return null;
    const stats = computeStats(entries);
    // If user provided profile defaults, blend them if stats has low confidence
    const effectiveAvgCycle = stats.cyclesTracked > 1 ? stats.avgCycle : (healthProfile?.avgCycleLength ?? stats.avgCycle);
    const effectiveAvgPeriod = stats.cyclesTracked > 1 ? stats.avgPeriod : (healthProfile?.avgPeriodLength ?? stats.avgPeriod);

    const preds = predict({ ...stats, avgCycle: effectiveAvgCycle, avgPeriod: effectiveAvgPeriod }, today, 4);
    const byDate = new Map<string, Entry>(entries.map((e) => [e.date, e]));
    const cdMap = cycleDays(entries, stats.periods);

    return {
      stats: { ...stats, avgCycle: effectiveAvgCycle, avgPeriod: effectiveAvgPeriod },
      preds,
      byDate,
      cdMap,
    };
  }, [entries, today, healthProfile]);

  if (!model) return <Spinner label="Decrypting your calendar…" />;
  const { stats, preds, byDate, cdMap } = model;

  const next = preds.find((p) => p.nextStart >= today) ?? preds[0];
  const daysToNext = next ? diffDays(today, next.nextStart) : null;
  const grid = monthGrid(cursor.y, cursor.m);
  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  // Selected date info
  const selectedEntry = byDate.get(selectedDate);

  // Compute cycle day for selected date
  let selectedCycleDay = cdMap.get(selectedDate);
  if (!selectedCycleDay && stats.periods.length > 0) {
    const lastStart = stats.periods[stats.periods.length - 1].start;
    const diff = diffDays(lastStart, selectedDate);
    if (diff >= 0) {
      selectedCycleDay = (diff % stats.avgCycle) + 1;
    }
  }

  const selectedPhase: Phase = selectedCycleDay
    ? phaseFor(selectedCycleDay, stats.avgCycle, stats.avgPeriod)
    : "follicular";

  const phaseInsight = PHASE_INSIGHTS[selectedPhase];

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow={formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
        title={selectedCycleDay ? `Cycle Day ${selectedCycleDay} · ${PHASE_COPY[selectedPhase]}` : "Your Private Cycle Calendar"}
        sub={
          selectedCycleDay
            ? `${phaseInsight.summary}`
            : "Select any day to inspect biological phases, symptoms, and private AI health analysis."
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Calendar Grid Card */}
        <Card className="comic-shadow">
          <div className="mb-4 flex items-center justify-between">
            <button
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-semibold hover:bg-card-2"
              onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <h2 className="font-display text-2xl text-text">{monthLabel}</h2>
            <button
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-semibold hover:bg-card-2"
              onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-faint">
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
              const isSelected = d === selectedDate;

              // Calculate rough phase for background highlight if cycle data exists
              let cDay = cdMap.get(d);
              if (!cDay && stats.periods.length > 0) {
                const diff = diffDays(stats.periods[stats.periods.length - 1].start, d);
                if (diff >= 0) cDay = (diff % stats.avgCycle) + 1;
              }
              const dPhase = cDay ? phaseFor(cDay, stats.avgCycle, stats.avgPeriod) : null;

              let style = "text-text hover:bg-card-2";
              if (kind === "period") {
                style = "bg-rose text-white font-bold shadow-sm";
              } else if (kind === "predicted") {
                style = "border-2 border-dashed border-rose text-rose font-semibold";
              } else if (kind === "ovulation") {
                style = "bg-gold text-white font-bold ring-2 ring-gold/40 shadow-sm";
              } else if (kind === "fertile") {
                style = "bg-lav-soft text-lav font-semibold border border-lav/40";
              } else if (dPhase === "luteal") {
                style = "bg-lav/5 text-muted";
              } else if (dPhase === "follicular") {
                style = "bg-accent/5 text-muted";
              }

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl p-1 text-sm transition ${style} ${
                    inMonth ? "" : "opacity-30"
                  } ${isSelected ? "ring-2 ring-text ring-offset-2" : isToday ? "ring-2 ring-accent ring-offset-1" : ""}`}
                  aria-label={`Select date ${d}`}
                >
                  <span>{+d.slice(8)}</span>
                  {e && (e.symptoms.length > 0 || e.mood) && kind !== "period" && (
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Phase Legend */}
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose" /> Period
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-dashed border-rose" /> Predicted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-lav/20 border border-lav/50" /> Fertile window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-gold" /> Ovulation
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-accent/15" /> Follicular
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-lav/10" /> Luteal
            </span>
          </div>
        </Card>

        {/* Selected Day Inspector & AI Insights */}
        <div className="space-y-5">
          <Card className="comic-shadow border-2 border-line">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Selected Day</p>
                <h3 className="font-display mt-0.5 text-2xl text-text">
                  {formatDate(selectedDate, { weekday: "short", month: "short", day: "numeric" })}
                </h3>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${PHASE_COLORS[selectedPhase].bg} ${PHASE_COLORS[selectedPhase].text}`}
              >
                {selectedCycleDay ? `Day ${selectedCycleDay} · ${PHASE_COPY[selectedPhase]}` : "Phase Estimate"}
              </span>
            </div>

            {/* AI Physiological Insight */}
            <div className="mt-4 rounded-xl border border-line bg-card-2 p-3.5 text-sm space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <span className="text-accent">✦</span> Private AI Biological Analysis
              </div>
              <p className="text-muted leading-relaxed">{phaseInsight.summary}</p>
              <div className="border-t border-line/60 pt-2 text-xs text-faint">
                <strong>Hormonal Profile:</strong> {phaseInsight.hormones}
              </div>
              <div className="text-xs text-muted">
                <strong>Recommendation:</strong> {phaseInsight.tips}
              </div>
              {healthProfile?.conditions && healthProfile.conditions.length > 0 && !healthProfile.conditions.includes("None / Regular") && (
                <div className="mt-2 rounded-lg bg-accent/10 p-2 text-xs text-accent">
                  <strong>Personalized note for {healthProfile.conditions.join(", ")}:</strong> Keep a close eye on cycle variability and symptom triggers during this phase.
                </div>
              )}
            </div>

            {/* Logged Data for Selected Date */}
            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">Logged Details</span>
                <LinkButton href={`/log?date=${selectedDate}`} variant="ghost" className="text-xs px-3 py-1 min-h-8">
                  {selectedEntry ? "Edit entry" : "Log this day"}
                </LinkButton>
              </div>

              {selectedEntry ? (
                <div className="mt-2 space-y-1.5 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-text">Flow:</span>
                    <span className="capitalize">{selectedEntry.flow}</span>
                  </div>
                  {selectedEntry.symptoms.length > 0 && (
                    <div>
                      <span className="font-medium text-text">Symptoms: </span>
                      {selectedEntry.symptoms.join(", ")}
                    </div>
                  )}
                  {selectedEntry.mood && (
                    <div>
                      <span className="font-medium text-text">Mood: </span>
                      <span className="capitalize">{selectedEntry.mood}</span>
                    </div>
                  )}
                  {selectedEntry.sleepHours != null && (
                    <div>
                      <span className="font-medium text-text">Sleep: </span>
                      {selectedEntry.sleepHours} hours
                    </div>
                  )}
                  {selectedEntry.notes && (
                    <div className="italic text-faint">&ldquo;{selectedEntry.notes}&rdquo;</div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-faint">
                  No symptoms or bleeding recorded for this day yet.
                </p>
              )}
            </div>
          </Card>

          {/* Next Period Summary */}
          <Card className="comic-shadow">
            <p className="text-sm text-muted">Next Cycle Forecast</p>
            {next ? (
              <>
                <p className="font-display mt-1 text-3xl text-text">
                  {daysToNext! > 0 ? `In ${daysToNext} days` : daysToNext === 0 ? "Expected today" : `${-daysToNext!} days late`}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Predicted start: {formatDate(next.nextStart, { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-lav/30 bg-lav/10 p-3">
                    <p className="font-semibold text-lav">Fertile Window</p>
                    <p className="mt-0.5 text-text">
                      {formatDate(next.fertileStart)} – {formatDate(next.fertileEnd)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gold/40 bg-gold/15 p-3">
                    <p className="font-semibold text-gold">Ovulation (est.)</p>
                    <p className="mt-0.5 text-text">{formatDate(next.ovulation)}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="font-display mt-1 text-xl text-text">Log a period to begin predictions</p>
            )}
            <p className="mt-3 text-xs text-faint">
              <span
                className={`mr-1 rounded-full px-2 py-0.5 ${
                  stats.confidence === "high"
                    ? "bg-ok/15 text-ok"
                    : stats.confidence === "medium"
                    ? "bg-warn/15 text-warn"
                    : "bg-card-2 text-muted"
                }`}
              >
                {stats.confidence} confidence
              </span>
              {stats.confidenceNote}
            </p>
            <div className="mt-2">
              <Disclaimer />
            </div>
          </Card>
        </div>
      </div>

      <AiInsightsCard entries={entries!} className="mt-6" />
    </div>
  );
}
