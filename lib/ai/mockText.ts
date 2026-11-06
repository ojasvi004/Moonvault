// Deterministic canned output for MockAiAdapter. Clearly labelled as a demo
// response in the UI (results carry mock: true).
import type { AiTask } from "@/lib/adapters/types";

export function mockAiText(task: AiTask, input: unknown): string {
  const stats = (input as { stats?: { avgCycle?: number; avgPeriod?: number } })?.stats ?? {};
  switch (task) {
    case "structure":
      return JSON.stringify({
        flow: "medium",
        symptoms: ["cramps", "headache"],
        symptomsText: "",
        mood: "low",
        sleepHours: 6.5,
        notes: "Felt a bit low today.",
        dayOffset: 0,
      });
    case "ask":
      return `Based on the entries you shared, your cycles average about ${stats.avgCycle ?? "—"} days and periods about ${stats.avgPeriod ?? "—"} days. Cramps show up most often on the first two days. This is informational only — if anything feels unusual, it's worth talking to a doctor.`;
    case "insights":
      return [
        "- Cramps appeared on cycle days 1–2 in most logged cycles.",
        "- Mood dipped in the few days before your period started.",
        "- Sleep was slightly shorter during the luteal phase.",
        "This week: In past cycles, energy picked up a few days after your period ended.",
        "Tip: Keep logging sleep and mood daily — patterns get clearer after 3+ cycles.",
      ].join("\n");
    case "day": {
      const day = (input as { day?: { cycleDay?: number; phase?: string } })?.day ?? {};
      return [
        `Summary: Cycle day ${day.cycleDay ?? "—"}, ${day.phase ?? "unknown"} phase.`,
        "Your pattern: Not enough past cycles around this day yet to spot a pattern.",
        "Logged: Nothing logged for this day.",
        "Watch for: Keep logging sleep and mood to sharpen this view.",
      ].join("\n");
    }
    case "summary":
      return [
        "Cycle overview",
        `- Average cycle length about ${stats.avgCycle ?? "—"} days.`,
        "Bleeding pattern",
        `- Periods last about ${stats.avgPeriod ?? "—"} days, heaviest on day 2.`,
        "Symptoms",
        "- Cramps and headache most common around day 1–2.",
        "Mood and sleep",
        "- Lower mood reported in the late luteal phase.",
        "Questions to ask",
        "- Is the cramp severity I log typical?",
      ].join("\n");
  }
}
