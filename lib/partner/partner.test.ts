import { describe, expect, it } from "vitest";
import { addDays, todayISO } from "@/lib/cycle/dates";
import type { Entry } from "@/lib/types";
import { buildPartnerPackage, parseInvite, partnerToday } from "./partner";

const today = todayISO();
const e = (date: string, flow: Entry["flow"], extra: Partial<Entry> = {}): Entry => ({
  id: date,
  date,
  flow,
  symptoms: ["cramps"],
  notes: "private note about Dr. Rao",
  sleepHours: 5,
  source: "manual",
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});

// Two periods 28 days apart; the latest started 10 days ago.
const entries: Entry[] = [
  ...[0, 1, 2, 3].map((i) => e(addDays(today, -38 + i), "medium")),
  ...[0, 1, 2, 3].map((i) => e(addDays(today, -10 + i), "heavy")),
  e(today, "none", { mood: "low" }),
];

describe("partner package", () => {
  it("never includes symptoms, notes or sleep", () => {
    const json = JSON.stringify(buildPartnerPackage(entries, { ownerName: "Asha", includeMood: true }));
    expect(json).not.toMatch(/cramps|Dr\. Rao|private note|sleep/i);
  });

  it("includes mood only when opted in", () => {
    expect(buildPartnerPackage(entries, { ownerName: "Asha", includeMood: false }).mood).toBeUndefined();
    expect(buildPartnerPackage(entries, { ownerName: "Asha", includeMood: true }).mood).toEqual({ date: today, mood: "low" });
  });

  it("computes cycle day and next period for the viewer", () => {
    const pkg = buildPartnerPackage(entries, { ownerName: "Asha", includeMood: false });
    expect(pkg.avgCycle).toBe(28);
    expect(pkg.next?.start).toBe(addDays(today, 18));
    const now = partnerToday(pkg, today);
    expect(now.cycleDay).toBe(11);
    expect(now.onPeriod).toBe(false);
    expect(partnerToday(pkg, addDays(today, 18)).onPeriod).toBe(true);
  });

  it("parses invite fragments and rejects damaged ones", () => {
    const key = "A".repeat(43); // 32 bytes base64url
    expect(parseInvite(`#abcdefghijklmnopqrstuv.${key}`).key).toHaveLength(32);
    expect(() => parseInvite("#abc")).toThrow(/incomplete/);
    expect(() => parseInvite(`#abcdefghijklmnopqrstuv.short`)).toThrow(/damaged/);
  });
});
