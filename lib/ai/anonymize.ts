// Build the minimal, anonymized excerpt that is sent to 0G for an AI request.
// - Absolute dates become "days ago" offsets.
// - Free text is scrubbed of emails, phone numbers, URLs, handles, long
//   numbers and capitalised words following titles (Dr., Mr., ...).
// - Internal IDs and timestamps are dropped.
import type { Entry } from "@/lib/types";

export type AnonEntry = {
  daysAgo: number;
  flow: Entry["flow"];
  symptoms?: string[];
  mood?: string;
  sleep?: number;
  note?: string;
  cycleDay?: number;
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const HANDLE = /(^|\s)@[A-Za-z0-9_]{2,}/g;
const LONGNUM = /\b\d{5,}\b/g;
const TITLED = /\b(Dr|Doctor|Mr|Mrs|Ms|Miss|Prof)\.?\s+[A-Z][a-zA-Z'-]+(\s+[A-Z][a-zA-Z'-]+)?/g;

export function scrubText(text: string | undefined, max = 280): string | undefined {
  if (!text) return undefined;
  const out = text
    .replace(EMAIL, "[email]")
    .replace(URL, "[link]")
    .replace(PHONE, "[number]")
    .replace(HANDLE, "$1[handle]")
    .replace(LONGNUM, "[number]")
    .replace(TITLED, "$1 [name]")
    .replace(/\s+/g, " ")
    .trim();
  return out ? out.slice(0, max) : undefined;
}

export function daysBetween(a: string, b: string): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86_400_000);
}

export type AnonOptions = { today: string; includeNotes?: boolean; cycleDays?: Map<string, number> };

export function anonymizeEntries(entries: Entry[], opts: AnonOptions): AnonEntry[] {
  return entries.map((e) => {
    const symptoms = [...e.symptoms, ...(e.symptomsText ? [scrubText(e.symptomsText, 80)!] : [])].filter(Boolean);
    const a: AnonEntry = { daysAgo: daysBetween(e.date, opts.today), flow: e.flow };
    if (symptoms.length) a.symptoms = symptoms;
    if (e.mood) a.mood = e.mood;
    if (typeof e.sleepHours === "number") a.sleep = e.sleepHours;
    if (opts.includeNotes && e.notes) a.note = scrubText(e.notes);
    const cd = opts.cycleDays?.get(e.date);
    if (cd) a.cycleDay = cd;
    return a;
  });
}

/** Pick entries relevant to a question: a recency window, capped in size. */
export function selectRelevant(entries: Entry[], question: string, today: string, cap = 120): Entry[] {
  const q = question.toLowerCase();
  let windowDays = 120;
  if (/\b(year|annual|12 months)\b/.test(q)) windowDays = 365;
  else if (/\b(6 months|six months|half)\b/.test(q)) windowDays = 190;
  else if (/\b(last|this) (week)\b/.test(q)) windowDays = 14;
  else if (/\b(last|this) (month|cycle)\b/.test(q)) windowDays = 45;
  const recent = entries.filter((e) => {
    const d = daysBetween(e.date, today);
    return d >= 0 && d <= windowDays;
  });
  return recent.slice(-cap);
}
