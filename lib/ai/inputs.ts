// Build the small, anonymized payloads for each AI task. Decryption happens
// in the browser; only these excerpts are sent.
import { computeStats, cycleDays, phaseFor } from "@/lib/cycle/cycle";
import { addDays, todayISO } from "@/lib/cycle/dates";
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
  return { stats: statsPayload(entries), data: data.slice(-180) };
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

/** Rough check that we're not sending too much. */
export function payloadSize(x: unknown): number {
  return new TextEncoder().encode(JSON.stringify(x)).length;
}
