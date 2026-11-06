// Build the small, anonymized payloads for each AI task. Decryption happens
// in the browser; only these excerpts are sent.
import { computeStats, cycleDays, cycleTimeline, phaseFor, predict } from "@/lib/cycle/cycle";
import { addDays, diffDays, todayISO } from "@/lib/cycle/dates";
import type { Entry } from "@/lib/types";
import { anonymizeEntries, selectRelevant } from "./anonymize";

function statsPayload(entries: Entry[]) {
  const s = computeStats(entries);
  return {
    avgCycleDays: s.avgCycle,
    avgPeriodDays: s.avgPeriod,
    variabilityDays: s.variability,
    shortestCycle: s.shortest,
    longestCycle: s.longest,
    cyclesTracked: s.cyclesTracked,
    recentCycleLengths: s.cycleLengths.slice(-6),
    confidence: s.confidence,
  };
}

export function askInput(entries: Entry[], question: string) {
  const today = todayISO();
  const rel = selectRelevant(entries, question, today);
  const stats = computeStats(entries);
  return {
    question: question.slice(0, 500),
    stats: statsPayload(entries),
    data: anonymizeEntries(rel, { today, includeNotes: true, cycleDays: cycleDays(rel, stats.periods) }),
  };
}

export function insightsInput(entries: Entry[]) {
  const today = todayISO();
  const recent = entries.filter((e) => e.date >= addDays(today, -200));
  const stats = computeStats(entries);
  const cd = cycleDays(recent, stats.periods);
  const data = anonymizeEntries(recent, { today, cycleDays: cd })
    .filter((e) => e.symptoms || e.mood || e.sleep !== undefined || e.flow !== "none")
    .map((e) => ({ ...e, phase: e.cycleDay ? phaseFor(e.cycleDay, stats.avgCycle, stats.avgPeriod) : undefined }));
  // Where the user is today, so the AI can say what their own history suggests for the coming days.
  const cycleDay = cycleDays([{ date: today } as Entry], stats.periods).get(today);
  const next = predict(stats, today, 2).find((p) => p.nextStart >= today);
  const now = cycleDay
    ? { cycleDay, phase: phaseFor(cycleDay, stats.avgCycle, stats.avgPeriod), daysToNextPeriod: next ? diffDays(today, next.nextStart) : undefined }
    : undefined;
  return { stats: statsPayload(entries), today: now, data: data.slice(-180) };
}

export function summaryInput(entries: Entry[]) {
  const today = todayISO();
  const recent = entries.filter((e) => e.date >= addDays(today, -183));
  const stats = computeStats(recent);
  return {
    stats: statsPayload(recent),
    data: anonymizeEntries(recent, { today, includeNotes: true, cycleDays: cycleDays(recent, stats.periods) }).slice(-183),
  };
}

/** One selected day: where it sits in the cycle, nearby days, and the same cycle day in past cycles. */
export function dayInput(entries: Entry[], date: string, overrides?: { avgCycle?: number; avgPeriod?: number }) {
  const today = todayISO();
  const base = computeStats(entries);
  const stats = { ...base, avgCycle: overrides?.avgCycle ?? base.avgCycle, avgPeriod: overrides?.avgPeriod ?? base.avgPeriod };
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const at = cycleTimeline(stats, byDate, today);
  const info = at(date);
  const cd = cycleDays(entries, stats.periods);

  const nearbyEntries = entries.filter((e) => Math.abs(diffDays(date, e.date)) <= 3);
  const nearby = anonymizeEntries(nearbyEntries, { today, includeNotes: true, cycleDays: cd });

  // Same cycle day (+/-1) in earlier logged cycles.
  const same = info
    ? entries.filter((e) => {
        if (e.date >= info.cycleStart) return false;
        const d = at(e.date);
        return !!d && !d.predicted && Math.abs(d.cycleDay - info.cycleDay) <= 1;
      })
    : [];
  const sameDayHistory = anonymizeEntries(same, { today, cycleDays: cd }).slice(-24);

  const e = byDate.get(date);
  return {
    stats: statsPayload(entries),
    day: {
      daysAgo: diffDays(date, today),
      cycleDay: info?.cycleDay,
      cycleLength: info?.cycleLength,
      phase: info?.phase,
      fertility: info?.fertility,
      ovulationDay: info?.ovulationDay,
      isPrediction: info ? info.predicted || date > today : undefined,
      logged: e ? anonymizeEntries([e], { today, includeNotes: true })[0] : null,
    },
    nearby,
    sameDayHistory,
  };
}

/** Rough check that we're not sending too much. */
export function payloadSize(x: unknown): number {
  return new TextEncoder().encode(JSON.stringify(x)).length;
}
