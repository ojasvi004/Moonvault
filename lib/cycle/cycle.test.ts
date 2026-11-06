import { describe, expect, it } from "vitest";
import type { Entry } from "@/lib/types";
import { computeStats, cycleDays, cycleTimeline, findPeriods, phaseFor, predict } from "./cycle";
import { addDays } from "./dates";

function period(start: string, days: number): Entry[] {
  return Array.from({ length: days }, (_, i) => ({
    id: `${start}-${i}`,
    date: addDays(start, i),
    flow: i === 1 ? "heavy" : "medium",
    symptoms: [],
    source: "manual" as const,
    createdAt: 0,
    updatedAt: 0,
  }));
}

describe("cycle math", () => {
  it("groups bleeding days into periods", () => {
    const entries = [...period("2026-01-01", 5), ...period("2026-01-29", 4)];
    const p = findPeriods(entries);
    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({ start: "2026-01-01", end: "2026-01-05", length: 5 });
  });

  it("averages recent cycles and predicts the next period", () => {
    const entries = [...period("2026-01-01", 5), ...period("2026-01-29", 5), ...period("2026-02-26", 5), ...period("2026-03-26", 5)];
    const s = computeStats(entries);
    expect(s.avgCycle).toBe(28);
    expect(s.avgPeriod).toBe(5);
    expect(s.confidence).toBe("high");
    const [next] = predict(s, "2026-04-01");
    expect(next.nextStart).toBe("2026-04-23");
    expect(next.ovulation).toBe("2026-04-09");
    expect(next.fertileStart).toBe("2026-04-04");
  });

  it("falls back to defaults with little data", () => {
    const s = computeStats(period("2026-01-01", 4));
    expect(s.avgCycle).toBe(28);
    expect(s.confidence).toBe("low");
  });

  it("ignores implausible gaps", () => {
    const entries = [...period("2026-01-01", 5), ...period("2026-04-01", 5), ...period("2026-04-30", 5)];
    const s = computeStats(entries);
    expect(s.avgCycle).toBe(29);
  });

  it("computes cycle days and phases", () => {
    const entries = [...period("2026-01-01", 5), { ...period("2026-01-15", 1)[0], flow: "none" as const }];
    const s = computeStats(entries);
    const cd = cycleDays(entries, s.periods);
    expect(cd.get("2026-01-15")).toBe(15);
    expect(phaseFor(2, 28, 5)).toBe("menstrual");
    expect(phaseFor(14, 28, 5)).toBe("ovulation");
    expect(phaseFor(22, 28, 5)).toBe("luteal");
  });
});

describe("cycle timeline", () => {
  const entries = [...period("2026-01-01", 5), ...period("2026-01-31", 5), ...period("2026-02-28", 5)];
  const stats = computeStats(entries);
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const at = cycleTimeline(stats, byDate, "2026-03-10");

  it("returns null before the first logged period", () => {
    expect(at("2025-12-31")).toBeNull();
  });

  it("uses the real length of a completed cycle", () => {
    const d = at("2026-01-10")!;
    expect(d.cycleLength).toBe(30);
    expect(d.cycleDay).toBe(10);
    expect(d.ovulationDay).toBe(16);
    expect(at("2026-01-16")!.ovulation).toBe(true);
    expect(at("2026-01-16")!.phase).toBe("ovulation");
    expect(at("2026-01-11")!.fertile).toBe(true);
    expect(at("2026-01-10")!.fertile).toBe(false);
    expect(at("2026-01-25")!.phase).toBe("luteal");
  });

  it("marks logged bleeding as menstrual and projects future periods", () => {
    expect(at("2026-02-28")!.bleeding).toBe(true);
    expect(at("2026-02-28")!.phase).toBe("menstrual");
    const next = at(addDays("2026-02-28", stats.avgCycle))!;
    expect(next.cycleDay).toBe(1);
    expect(next.predicted).toBe(true);
    expect(next.predictedPeriod).toBe(true);
    expect(next.phase).toBe("menstrual");
  });
});
