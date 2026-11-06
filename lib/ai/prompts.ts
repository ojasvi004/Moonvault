// Prompt builders. Used server-side by /api/ai/chat so the proxy can only
// run Moonvault's fixed tasks (it is not a general chat relay).
import type { AiTask } from "@/lib/adapters/types";
import { FLOWS, MOODS, SYMPTOMS } from "@/lib/types";

const SAFETY = [
  "You are Moonvault's cycle assistant. You give general, informational explanations only.",
  "Never diagnose, never name a condition the user has or might have, never recommend medication or dosages.",
  "If something could be a medical concern (very heavy bleeding, severe pain, cycles under 21 or over 35 days, missed periods, bleeding between periods), say plainly that it is worth discussing with a doctor.",
  "Ground every statement in the data provided. If the data does not answer the question, say so. Do not invent entries.",
  "Day offsets: daysAgo=0 is today. Do not guess real calendar dates.",
].join(" ");

export type ChatMessage = { role: "system" | "user"; content: string };

export function buildMessages(task: AiTask, input: Record<string, unknown>): { messages: ChatMessage[]; json: boolean; maxTokens: number } {
  switch (task) {
    case "structure":
      return {
        json: true,
        maxTokens: 400,
        messages: [
          {
            role: "system",
            content: [
              "Convert a spoken period-tracker log into strict JSON. Output only a JSON object with these keys:",
              `"flow": one of ${JSON.stringify(FLOWS)} (use "none" if not mentioned),`,
              `"symptoms": array using only these values when they match: ${JSON.stringify(SYMPTOMS)},`,
              '"symptomsText": string of any other symptoms not in the list, or "",',
              `"mood": one of ${JSON.stringify(MOODS)} or null,`,
              '"sleepHours": number between 0 and 24 or null,',
              '"notes": short neutral summary of anything else said, or "",',
              '"dayOffset": 0 for today, -1 for yesterday, etc. (integer, default 0).',
              "Do not add any other keys. Do not include names of people.",
            ].join(" "),
          },
          { role: "user", content: `Transcript: ${JSON.stringify(String(input.transcript ?? "").slice(0, 2000))}` },
        ],
      };
    case "ask":
      return {
        json: false,
        maxTokens: 600,
        messages: [
          { role: "system", content: `${SAFETY} Answer in at most 6 short sentences or bullets, warm and plain-spoken.` },
          {
            role: "user",
            content: `My tracked data (anonymized):\n${JSON.stringify(input.data)}\n\nLocally computed stats:\n${JSON.stringify(input.stats)}\n\nQuestion: ${String(input.question ?? "").slice(0, 500)}`,
          },
        ],
      };
    case "insights":
      return {
        json: false,
        maxTokens: 700,
        messages: [
          {
            role: "system",
            content: `${SAFETY} You explain patterns. The stats were computed by the app; do not recompute them, interpret them. Find symptoms, moods or sleep changes that recur at a similar cycle day or phase (menstrual ~days 1-5, follicular, ovulation window ~14 days before the next period, luteal). Output 3 to 5 bullets starting with "- ", each naming the pattern and how often it appeared (e.g. "in 3 of 4 cycles"). If "Today" is given, add one line starting with "This week:" saying what the user's own history suggests for the next few days at this point in the cycle (only if the data supports it). Then one line starting with "Tip:" with a general, non-medical self-care or tracking suggestion.`,
          },
          { role: "user", content: `Stats: ${JSON.stringify(input.stats)}\nToday: ${JSON.stringify(input.today ?? null)}\nEntries with cycle day: ${JSON.stringify(input.data)}` },
        ],
      };
    case "day":
      return {
        json: false,
        maxTokens: 450,
        messages: [
          {
            role: "system",
            content: `${SAFETY} You analyse ONE selected day of the user's cycle. The app has already computed the cycle day, phase and fertility estimate; interpret them, do not recompute. Use the user's own history for the same cycle days in past cycles ("sameDayHistory") and the days around the selected day ("nearby"). Output exactly these lines, each starting with the label: "Summary:" one or two sentences about where this day sits in the cycle and what the body is typically doing. "Your pattern:" what the user's own past cycles show around this cycle day (symptoms, mood, sleep, flow), with counts like "in 2 of 3 cycles"; if there is not enough history, say so plainly. "Logged:" one sentence about what was logged on this day, or "Nothing logged for this day." "Watch for:" one short, practical, non-medical tip for this day. Keep the whole answer under 110 words.`,
          },
          { role: "user", content: `Selected day: ${JSON.stringify(input.day)}\nStats: ${JSON.stringify(input.stats)}\nNearby days: ${JSON.stringify(input.nearby)}\nSame cycle day in past cycles: ${JSON.stringify(input.sameDayHistory)}` },
        ],
      };
    case "summary":
      return {
        json: false,
        maxTokens: 900,
        messages: [
          {
            role: "system",
            content: `${SAFETY} Write a concise, neutral summary a patient can hand to their doctor, covering roughly the last 6 months. Use exactly these headings on their own lines: "Cycle overview", "Bleeding pattern", "Symptoms", "Mood and sleep", "Questions to ask". Under each heading write 2-4 short bullet lines starting with "- ". Use clinical but plain language. No diagnosis. Under "Questions to ask" suggest questions the patient might ask, not answers.`,
          },
          { role: "user", content: `Stats: ${JSON.stringify(input.stats)}\nEntries: ${JSON.stringify(input.data)}` },
        ],
      };
  }
}

export const MAX_INPUT_BYTES = 64 * 1024;
