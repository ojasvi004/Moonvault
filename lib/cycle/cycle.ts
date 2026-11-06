// Local cycle math. Simple averages of recent cycles; informational only.
import type { Entry } from "@/lib/types";
import { addDays, diffDays } from "./dates";

export const DEFAULT_CYCLE = 28;
export const DEFAULT_PERIOD = 5;
const RECENT = 6;

export type Period = { start: string; end: string; length: number };

export type CycleStats = {
  periods: Period[];
  cycleLengths: number[]; // between consecutive starts
  avgCycle: number;
  avgPeriod: number;
  variability: number; // standard deviation of recent cycle lengths (days)
  shortest?: number;
  longest?: number;
  cyclesTracked: number;
  confidence: "low" | "medium" | "high";
  confidenceNote: string;
};

export type Prediction = {
  nextStart: string;
  nextEnd: string;
  ovulation: string;
  fertileStart: string;
  fertileEnd: string;
};

const BLEEDING = new Set(["light", "medium", "heavy"]);

/** Group bleeding days into periods; gaps of up to 2 days stay in one period. */
export function findPeriods(entries: Entry[]): Period[] {
  const days = [...new Set(entries.filter((e) => BLEEDING.has(e.flow)).map((e) => e.date))].sort();
  const periods: Period[] = [];
  for (const d of days) {
    const cur = periods[periods.length - 1];
    if (cur && diffDays(cur.end, d) <= 3) {
      cur.end = d;
      cur.length = diffDays(cur.start, d) + 1;
    } else {
      periods.push({ start: d, end: d, length: 1 });
    }
  }
  return periods;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function computeStats(entries: Entry[]): CycleStats {
  const periods = findPeriods(entries);
  const cycleLengths: number[] = [];
  for (let i = 1; i < periods.length; i++) cycleLengths.push(diffDays(periods[i - 1].start, periods[i].start));
  // Ignore implausible gaps (likely missed logging) for the average.
  const usable = cycleLengths.filter((c) => c >= 15 && c <= 60).slice(-RECENT);
  const avgCycle = usable.length ? Math.round(mean(usable)) : DEFAULT_CYCLE;
  const recentPeriods = periods.slice(-RECENT).map((p) => p.length);
  const avgPeriod = recentPeriods.length ? Math.round(mean(recentPeriods)) : DEFAULT_PERIOD;
  const variability = usable.length > 1 ? Math.sqrt(mean(usable.map((c) => (c - mean(usable)) ** 2))) : 0;

  let confidence: CycleStats["confidence"] = "low";
  let confidenceNote = "Log at least two periods for a personal estimate. Until then we assume a 28-day cycle.";
  if (usable.length >= 1) {
    confidence = usable.length >= 3 && variability <= 3 ? "high" : "medium";
    confidenceNote =
      confidence === "high"
        ? `Based on your last ${usable.length} cycles, which are fairly regular.`
        : variability > 3
          ? `Your cycles vary by about ±${Math.round(variability)} days, so dates are approximate.`
          : `Based on ${usable.length} cycle${usable.length > 1 ? "s" : ""}. Accuracy improves as you log more.`;
  }
  return {
    periods,
    cycleLengths,
    avgCycle,
    avgPeriod,
    variability: Math.round(variability * 10) / 10,
    shortest: usable.length ? Math.min(...usable) : undefined,
    longest: usable.length ? Math.max(...usable) : undefined,
    cyclesTracked: usable.length,
    confidence,
    confidenceNote,
  };
}

/** Predict the next `count` cycles after the last logged period. */
export function predict(stats: CycleStats, today: string, count = 3): Prediction[] {
  const last = stats.periods[stats.periods.length - 1];
  if (!last) return [];
  const out: Prediction[] = [];
  let start = addDays(last.start, stats.avgCycle);
  // If the predicted date is already well past, roll forward so predictions stay useful.
  while (diffDays(start, today) > stats.avgCycle) start = addDays(start, stats.avgCycle);
  for (let i = 0; i < count; i++) {
    const ovulation = addDays(start, -14);
    out.push({
      nextStart: start,
      nextEnd: addDays(start, stats.avgPeriod - 1),
      ovulation,
      fertileStart: addDays(ovulation, -5),
      fertileEnd: addDays(ovulation, 1),
    });
    start = addDays(start, stats.avgCycle);
  }
  return out;
}

/** Map each logged date to its cycle day (1 = first day of period). */
export function cycleDays(entries: Entry[], periods: Period[]): Map<string, number> {
  const map = new Map<string, number>();
  const starts = periods.map((p) => p.start);
  for (const e of entries) {
    let s: string | undefined;
    for (const st of starts) if (st <= e.date) s = st;
    if (s) map.set(e.date, diffDays(s, e.date) + 1);
  }
  return map;
}

export type Phase = "menstrual" | "follicular" | "ovulation" | "luteal";

export function phaseFor(cycleDay: number, avgCycle: number, avgPeriod: number): Phase {
  const ov = avgCycle - 14;
  if (cycleDay <= avgPeriod) return "menstrual";
  if (cycleDay >= ov - 2 && cycleDay <= ov + 1) return "ovulation";
  if (cycleDay < ov - 2) return "follicular";
  return "luteal";
}

export type DayKind = "period" | "predicted" | "fertile" | "ovulation" | null;

export function dayKind(date: string, entriesByDate: Map<string, Entry>, preds: Prediction[]): DayKind {
  const e = entriesByDate.get(date);
  if (e && BLEEDING.has(e.flow)) return "period";
  for (const p of preds) {
    if (date === p.ovulation) return "ovulation";
    if (date >= p.nextStart && date <= p.nextEnd) return "predicted";
    if (date >= p.fertileStart && date <= p.fertileEnd) return "fertile";
  }
  return null;
}

// ------------------------------------------------------------------ day timeline

export type DayInfo = {
  /** 1 = first day of the period that started this cycle. */
  cycleDay: number;
  cycleLength: number;
  cycleStart: string;
  phase: Phase;
  /** Bleeding logged on this day. */
  bleeding: boolean;
  /** Expected (not logged) period day of a future or overdue cycle. */
  predictedPeriod: boolean;
  fertile: boolean;
  ovulation: boolean;
  /** Estimated cycle day of ovulation for this cycle. */
  ovulationDay: number;
  /** True when this day belongs to a cycle that has not been logged yet. */
  predicted: boolean;
  fertility: "low" | "medium" | "high" | "peak";
};

/**
 * Builds a lookup that places any date in a cycle: logged cycles use their real
 * length (start to next start), the current and future cycles use the average.
 * Dates before the first logged period return null.
 */
export function cycleTimeline(stats: CycleStats, entriesByDate: Map<string, Entry>, today: string) {
  const periods = stats.periods;
  const avgCycle = stats.avgCycle;
  const avgPeriod = stats.avgPeriod;

  return (date: string): DayInfo | null => {
    if (!periods.length || date < periods[0].start) return null;
    let i = periods.length - 1;
    while (i > 0 && periods[i].start > date) i--;
    const p = periods[i];
    const nextStart = periods[i + 1]?.start;
    const actualLen = nextStart ? diffDays(p.start, nextStart) : undefined;

    let cycleStart = p.start;
    let cycleLength = avgCycle;
    let periodLength = p.length;
    let predicted = false;

    if (actualLen && actualLen <= Math.max(45, avgCycle * 1.6)) {
      cycleLength = actualLen;
    } else {
      // Current cycle, or a long gap (likely missed logging): project forward with the average.
      const diff = diffDays(p.start, date);
      const k = Math.floor(diff / avgCycle);
      if (k > 0) {
        cycleStart = addDays(p.start, k * avgCycle);
        periodLength = avgPeriod;
        predicted = true;
      } else {
        // Period still ongoing (bleeding logged today or yesterday): expect it to run to the average length.
        const ongoing = diffDays(p.end, today) <= 1 && diffDays(p.start, today) < avgPeriod;
        periodLength = ongoing ? Math.max(p.length, avgPeriod) : p.length;
      }
    }

    const cycleDay = diffDays(cycleStart, date) + 1;
    const ovulationDay = Math.max(periodLength + 2, cycleLength - 14);
    const bleeding = BLEEDING.has(entriesByDate.get(date)?.flow ?? "none");
    const predictedPeriod = !bleeding && cycleDay <= periodLength && (predicted || date > today);
    const ovulation = cycleDay === ovulationDay;
    const fertile = cycleDay >= ovulationDay - 5 && cycleDay <= ovulationDay + 1;

    let phase: Phase;
    if (bleeding || cycleDay <= periodLength) phase = "menstrual";
    else if (cycleDay >= ovulationDay - 1 && cycleDay <= ovulationDay + 1) phase = "ovulation";
    else if (cycleDay < ovulationDay - 1) phase = "follicular";
    else phase = "luteal";

    const fertility: DayInfo["fertility"] = ovulation
      ? "peak"
      : cycleDay >= ovulationDay - 2 && cycleDay <= ovulationDay + 1
        ? "high"
        : fertile
          ? "medium"
          : "low";

    return { cycleDay, cycleLength, cycleStart, phase, bleeding, predictedPeriod, fertile, ovulation, ovulationDay, predicted, fertility };
  };
}
