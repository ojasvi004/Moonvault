// Validation of the strict JSON the model returns for voice structuring.
import { FLOWS, MOODS, SYMPTOMS, type Flow, type Mood } from "@/lib/types";

export type StructuredLog = {
  flow: Flow;
  symptoms: string[];
  symptomsText: string;
  mood: Mood | null;
  sleepHours: number | null;
  notes: string;
  dayOffset: number;
};

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI did not return structured data.");
  return JSON.parse(t.slice(start, end + 1));
}

export function parseStructured(text: string): StructuredLog {
  const raw = extractJson(text) as Record<string, unknown>;
  const flow = (FLOWS as readonly string[]).includes(String(raw.flow)) ? (raw.flow as Flow) : "none";
  const allowed = new Set<string>(SYMPTOMS);
  const symptoms = Array.isArray(raw.symptoms)
    ? [...new Set(raw.symptoms.map((s) => String(s).toLowerCase().trim()).filter((s) => allowed.has(s)))]
    : [];
  const mood = (MOODS as readonly string[]).includes(String(raw.mood)) ? (raw.mood as Mood) : null;
  const sleepNum = typeof raw.sleepHours === "number" ? raw.sleepHours : Number(raw.sleepHours);
  const sleepHours = Number.isFinite(sleepNum) && sleepNum >= 0 && sleepNum <= 24 ? Math.round(sleepNum * 2) / 2 : null;
  const off = Math.trunc(Number(raw.dayOffset ?? 0));
  return {
    flow,
    symptoms,
    symptomsText: typeof raw.symptomsText === "string" ? raw.symptomsText.slice(0, 200) : "",
    mood,
    sleepHours,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 500) : "",
    dayOffset: Number.isFinite(off) && off <= 0 && off >= -14 ? off : 0,
  };
}
