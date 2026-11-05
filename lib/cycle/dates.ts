// Calendar-date helpers on "YYYY-MM-DD" strings (timezone-safe: UTC math).

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

function utc(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
}

export function addDays(iso: string, n: number): string {
  const d = new Date(utc(iso) + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** b - a in days. */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Date(utc(iso)).toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
}

export function monthGrid(year: number, month: number): string[] {
  // 6x7 grid starting Monday, as ISO dates.
  const first = new Date(Date.UTC(year, month, 1));
  const weekday = (first.getUTCDay() + 6) % 7;
  const start = addDays(first.toISOString().slice(0, 10), -weekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
