"use client";
import { useEffect, useMemo, useState } from "react";
import { AiInsightsCard } from "@/components/AiInsightsCard";
import { DayAnalysis } from "@/components/DayAnalysis";
import { useEntries } from "@/components/hooks";
import { Card, LinkButton, Spinner } from "@/components/ui";
import { computeStats, cycleTimeline, predict, type DayInfo, type Phase } from "@/lib/cycle/cycle";
import { diffDays, formatDate, monthGrid, todayISO } from "@/lib/cycle/dates";
import { getHealthProfile, type HealthProfile } from "@/lib/vault/healthProfile";
import type { Entry } from "@/lib/types";

const PHASE: Record<Phase, { label: string; short: string; chip: string; bar: string; cell: string }> = {
  menstrual: { label: "Menstrual phase", short: "Period", chip: "bg-rose/10 text-rose border-rose/30", bar: "bg-rose", cell: "" },
  follicular: { label: "Follicular phase", short: "Follicular", chip: "bg-accent/10 text-accent border-accent/30", bar: "bg-accent", cell: "bg-accent/10" },
  ovulation: { label: "Ovulation window", short: "Ovulation", chip: "bg-gold/15 text-gold border-gold/40", bar: "bg-gold", cell: "bg-gold/15" },
  luteal: { label: "Luteal phase", short: "Luteal", chip: "bg-lav/10 text-lav border-lav/30", bar: "bg-lav/40", cell: "bg-lav/5" },
};

const PHASE_GUIDE: Record<Phase, { body: string; hormones: string; tip: string }> = {
  menstrual: {
    body: "The uterine lining sheds. Estrogen and progesterone are at their lowest, so energy often dips.",
    hormones: "Low estrogen, low progesterone",
    tip: "Warm, iron-rich meals, magnesium, gentle movement and extra rest.",
  },
  follicular: {
    body: "Follicles mature and rising estrogen often lifts stamina, focus and mood.",
    hormones: "Estrogen rising, FSH active",
    tip: "A good window for harder workouts and starting new things.",
  },
  ovulation: {
    body: "An LH surge releases an egg. Estrogen peaks and basal body temperature rises slightly afterwards.",
    hormones: "LH surge, estrogen peak",
    tip: "Most fertile days. Stay hydrated; some people notice mild one-sided twinges.",
  },
  luteal: {
    body: "Progesterone dominates. Late in this phase, hormones fall and PMS symptoms can appear.",
    hormones: "Progesterone high, then both fall",
    tip: "Steady meals, less caffeine, and protecting sleep can ease the last few days.",
  },
};

const FERTILITY_LEVEL = { low: 1, medium: 2, high: 3, peak: 4 } as const;
const MOOD_EMOJI: Record<string, string> = { great: "😄", good: "🙂", okay: "😐", low: "😔", bad: "😣" };

export default function CalendarPage() {
  const { entries } = useEntries();
  const today = todayISO();
  const [cursor, setCursor] = useState(() => ({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 }));
  const [selected, setSelected] = useState<string>(today);
  const [profile, setProfile] = useState<HealthProfile | null>(null);

  useEffect(() => {
    void getHealthProfile().then(setProfile);
  }, []);

  const model = useMemo(() => {
    if (!entries) return null;
    const raw = computeStats(entries);
    // Until two cycles are logged, the onboarding answers are a better guess than the defaults.
    const avgCycle = raw.cyclesTracked >= 1 ? raw.avgCycle : (profile?.avgCycleLength ?? raw.avgCycle);
    const avgPeriod = raw.periods.length >= 2 ? raw.avgPeriod : (profile?.avgPeriodLength ?? raw.avgPeriod);
    const stats = { ...raw, avgCycle, avgPeriod };
    const byDate = new Map<string, Entry>(entries.map((e) => [e.date, e]));
    const at = cycleTimeline(stats, byDate, today);
    const preds = predict(stats, today, 3);
    return { stats, byDate, at, preds, overrides: { avgCycle, avgPeriod } };
  }, [entries, today, profile]);

  if (!model || !entries) return <Spinner label="Decrypting your calendar…" />;
  const { stats, byDate, at, preds, overrides } = model;

  const todayInfo = at(today);
  const next = preds.find((p) => p.nextStart >= today) ?? preds[0];
  const daysToNext = next ? diffDays(today, next.nextStart) : null;
  const grid = monthGrid(cursor.y, cursor.m);
  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const selInfo = at(selected);
  const selEntry = byDate.get(selected);

  const goTo = (iso: string) => {
    setSelected(iso);
    setCursor({ y: +iso.slice(0, 4), m: +iso.slice(5, 7) - 1 });
  };

  return (
    <div className="space-y-6">
      {/* Header / today summary */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{formatDate(today, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="font-display mt-1 text-3xl sm:text-4xl">
            {todayInfo ? (
              <>
                Cycle day {todayInfo.cycleDay} <span className="text-muted">· {PHASE[todayInfo.phase].label}</span>
              </>
            ) : (
              "Your cycle calendar"
            )}
          </h1>
          <p className="mt-1 text-muted">
            {next && daysToNext !== null
              ? daysToNext > 0
                ? `Next period in ${daysToNext} day${daysToNext === 1 ? "" : "s"} · ${formatDate(next.nextStart, { weekday: "short", day: "numeric", month: "short" })}`
                : daysToNext === 0
                  ? "Your period is expected today."
                  : `Your period is ${-daysToNext} day${daysToNext === -1 ? "" : "s"} later than expected.`
              : "Log your period to see your phases, fertile window and predictions."}
          </p>
        </div>
        <LinkButton href={`/log?date=${today}`} className="comic-sm comic-hover self-start sm:self-auto">
          + Log today
        </LinkButton>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Month grid */}
        <Card className="comic !rounded-3xl">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              className="comic-sm rounded-full bg-card px-3.5 py-1.5 text-sm font-semibold hover:bg-card-2"
              onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl sm:text-2xl">{monthLabel}</h2>
              <button className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:text-text" onClick={() => goTo(today)}>
                Today
              </button>
            </div>
            <button
              className="comic-sm rounded-full bg-card px-3.5 py-1.5 text-sm font-semibold hover:bg-card-2"
              onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-faint">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {grid.map((d) => (
              <DayCell
                key={d}
                date={d}
                info={at(d)}
                entry={byDate.get(d)}
                inMonth={+d.slice(5, 7) - 1 === cursor.m}
                isToday={d === today}
                isSelected={d === selected}
                onClick={() => setSelected(d)}
              />
            ))}
          </div>

          <Legend />
        </Card>

        {/* Selected day */}
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <DayPanel date={selected} info={selInfo} entry={selEntry} today={today} />
          <DayAnalysis entries={entries} date={selected} info={selInfo} overrides={overrides} />
        </div>
      </div>

      {/* Forecast */}
      <Card className="comic-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Forecast</p>
            <h2 className="font-display mt-1 text-2xl">Your next cycles</h2>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              stats.confidence === "high" ? "border-ok/30 bg-ok/10 text-ok" : stats.confidence === "medium" ? "border-warn/30 bg-warn/10 text-warn" : "border-line bg-card-2 text-muted"
            }`}
          >
            {stats.confidence} confidence
          </span>
        </div>
        {preds.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {preds.map((p, i) => (
              <button key={p.nextStart} onClick={() => goTo(p.nextStart)} className="comic-sm comic-hover rounded-2xl bg-card p-4 text-left">
                <p className="text-xs font-semibold text-faint">{i === 0 ? "Next" : `In ${i + 1} cycles`}</p>
                <p className="font-display mt-1 text-xl text-rose">
                  {formatDate(p.nextStart, { day: "numeric", month: "short" })} – {formatDate(p.nextEnd, { day: "numeric", month: "short" })}
                </p>
                <p className="mt-2 text-xs text-muted">
                  <span className="font-semibold text-lav">Fertile</span> {formatDate(p.fertileStart)} – {formatDate(p.fertileEnd)}
                </p>
                <p className="text-xs text-muted">
                  <span className="font-semibold text-gold">Ovulation</span> ~{formatDate(p.ovulation, { weekday: "short", day: "numeric", month: "short" })}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-muted">Log a period (or add your last period date in Profile) to start predictions.</p>
        )}
        <div className="mt-4 grid gap-2 text-xs text-muted sm:grid-cols-4">
          <Stat label="Avg cycle" value={`${stats.avgCycle} days`} />
          <Stat label="Avg period" value={`${stats.avgPeriod} days`} />
          <Stat label="Cycles tracked" value={String(stats.cyclesTracked)} />
          <Stat label="Variability" value={stats.cyclesTracked > 1 ? `±${stats.variability} days` : "—"} />
        </div>
      </Card>

      <AiInsightsCard entries={entries} />
    </div>
  );
}

/* --------------------------------------------------------------------------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card-2/60 px-3 py-2">
      <p className="text-faint">{label}</p>
      <p className="font-semibold text-text">{value}</p>
    </div>
  );
}

function DayCell({
  date,
  info,
  entry,
  inMonth,
  isToday,
  isSelected,
  onClick,
}: {
  date: string;
  info: DayInfo | null;
  entry?: Entry;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  let cls = "bg-card-2/40 text-text";
  let mark: React.ReactNode = null;
  if (info?.bleeding) {
    cls = entry?.flow === "heavy" ? "bg-rose text-white font-bold" : entry?.flow === "light" ? "bg-rose/70 text-white font-semibold" : "bg-rose/85 text-white font-bold";
  } else if (entry?.flow === "spotting") {
    cls = "bg-rose/10 text-rose font-semibold";
  } else if (info?.predictedPeriod) {
    cls = "hatch-rose border border-dashed border-rose/70 text-rose font-semibold";
  } else if (info?.ovulation) {
    cls = "bg-gold text-accent-ink font-bold";
    mark = <span className="absolute left-1 top-0.5 text-[9px]">★</span>;
  } else if (info?.fertile) {
    cls = "bg-lav-soft text-lav font-semibold";
  } else if (info) {
    cls = `${PHASE[info.phase].cell} text-text`;
  }

  const dots: string[] = [];
  if (entry?.symptoms.length || entry?.symptomsText) dots.push("bg-accent");
  if (entry?.mood) dots.push("bg-lav");
  if (entry?.sleepHours != null) dots.push("bg-ok");
  if (entry?.notes) dots.push("bg-muted");
  const onDark = !!info?.bleeding;

  const label = [
    formatDate(date, { weekday: "long", day: "numeric", month: "long" }),
    info ? `cycle day ${info.cycleDay}` : null,
    info?.bleeding ? "period" : info?.predictedPeriod ? "predicted period" : info?.ovulation ? "estimated ovulation" : info?.fertile ? "fertile window" : info ? PHASE[info.phase].short : null,
    entry ? "has log" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isSelected}
      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${cls} ${inMonth ? "" : "opacity-35"} ${
        isSelected ? "z-10 scale-[1.04] outline-2 outline-offset-2 outline-ink shadow-[3px_3px_0_0_var(--shadow)]" : "hover:brightness-[0.97]"
      }`}
    >
      {mark}
      {info && <span className={`absolute right-1 top-0.5 hidden text-[9px] sm:block ${onDark ? "text-white/80" : "text-faint"}`}>{info.cycleDay}</span>}
      <span className={isToday ? `grid h-7 w-7 place-items-center rounded-full ${onDark ? "bg-card text-rose" : "bg-ink text-white"}` : ""}>{+date.slice(8)}</span>
      {dots.length > 0 && (
        <span className="absolute bottom-1 flex gap-0.5">
          {dots.map((c) => (
            <span key={c} className={`h-1 w-1 rounded-full ${onDark ? "bg-card" : c}`} />
          ))}
        </span>
      )}
    </button>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-rose", "Period"],
    ["hatch-rose border border-dashed border-rose/70", "Predicted period"],
    ["bg-accent/10 border border-accent/30", "Follicular"],
    ["bg-lav-soft border border-lav/40", "Fertile window"],
    ["bg-gold", "Ovulation"],
    ["bg-lav/5 border border-lav/20", "Luteal"],
  ];
  return (
    <div className="mt-5 space-y-2 border-t border-line pt-4 text-xs text-muted">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={`h-3.5 w-3.5 rounded ${c}`} /> {l}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> symptoms
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-lav" /> mood
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" /> sleep
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted" /> note
        </span>
        <span>· small number = cycle day</span>
      </div>
    </div>
  );
}

function DayPanel({ date, info, entry, today }: { date: string; info: DayInfo | null; entry?: Entry; today: string }) {
  const future = date > today;
  const guide = info ? PHASE_GUIDE[info.phase] : null;
  return (
    <Card className="comic !rounded-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-faint">{date === today ? "Today" : future ? "Upcoming day" : "Past day"}</p>
          <h3 className="font-display text-2xl">{formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</h3>
        </div>
        {info && <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${PHASE[info.phase].chip}`}>{PHASE[info.phase].short}</span>}
      </div>

      {info ? (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-line bg-card-2/50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-faint">Cycle day</p>
            <p className="font-display text-2xl">
              {info.cycleDay}
              <span className="text-sm text-faint">/{info.cycleLength}</span>
            </p>
          </div>
          <div className="rounded-xl border border-line bg-card-2/50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-faint">Fertility</p>
            <div className="mt-1.5 flex justify-center gap-0.5" aria-label={`Fertility ${info.fertility}`}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={`h-4 w-2 rounded-sm ${n <= FERTILITY_LEVEL[info.fertility] ? (info.fertility === "peak" ? "bg-gold" : "bg-lav") : "bg-line"}`} />
              ))}
            </div>
            <p className="mt-1 text-xs font-semibold capitalize">{info.fertility}</p>
          </div>
          <div className="rounded-xl border border-line bg-card-2/50 p-2">
            <p className="text-[10px] uppercase tracking-wider text-faint">Status</p>
            <p className="mt-1 text-sm font-semibold">{info.bleeding ? "Period logged" : info.predictedPeriod ? "Period expected" : info.ovulation ? "Ovulation (est.)" : info.fertile ? "Fertile" : info.predicted || future ? "Predicted" : "—"}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-card-2/60 p-3 text-sm text-muted">This day is before your first logged period, so we can&apos;t place it in a cycle.</p>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Logged</span>
          {!future && (
            <LinkButton href={`/log?date=${date}`} variant="ghost" className="min-h-8 px-3 py-1 text-xs">
              {entry ? "Edit entry" : "Log this day"}
            </LinkButton>
          )}
        </div>
        {entry ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-faint">Flow</dt>
            <dd className="capitalize">{entry.flow === "none" ? "No bleeding" : entry.flow}</dd>
            {(entry.symptoms.length > 0 || entry.symptomsText) && (
              <>
                <dt className="text-faint">Symptoms</dt>
                <dd className="flex flex-wrap gap-1">
                  {entry.symptoms.map((s) => (
                    <span key={s} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs capitalize text-accent">
                      {s}
                    </span>
                  ))}
                  {entry.symptomsText && <span className="text-xs text-muted">{entry.symptomsText}</span>}
                </dd>
              </>
            )}
            {entry.mood && (
              <>
                <dt className="text-faint">Mood</dt>
                <dd className="capitalize">
                  {MOOD_EMOJI[entry.mood]} {entry.mood}
                </dd>
              </>
            )}
            {entry.sleepHours != null && (
              <>
                <dt className="text-faint">Sleep</dt>
                <dd>{entry.sleepHours} h</dd>
              </>
            )}
            {entry.notes && (
              <>
                <dt className="text-faint">Note</dt>
                <dd className="italic text-muted">&ldquo;{entry.notes}&rdquo;</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-faint">{future ? "This day hasn't happened yet." : "Nothing logged for this day."}</p>
        )}
      </div>

      {guide && info && (
        <details className="group mt-4 rounded-2xl border border-line bg-card-2/40 p-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
            About the {PHASE[info.phase].label.toLowerCase()}
            <span className="text-faint transition group-open:rotate-180">⌄</span>
          </summary>
          <p className="mt-2 text-muted">{guide.body}</p>
          <p className="mt-2 text-xs text-faint">
            <strong className="text-muted">Hormones:</strong> {guide.hormones}
          </p>
          <p className="mt-1 text-xs text-faint">
            <strong className="text-muted">Try:</strong> {guide.tip}
          </p>
        </details>
      )}
    </Card>
  );
}
