"use client";

import { useMemo, useState } from "react";
import { Button, ErrorBox, Field, Notice } from "@/components/ui";
import { addDays, todayISO } from "@/lib/cycle/dates";
import { saveEntry } from "@/lib/vault/entries";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HistoricalCycleDialog({ open, onClose }: Props) {
  const today = todayISO();
  const earliest = addDays(today, -365);
  const [cycles, setCycles] = useState("5");
  const [latestStart, setLatestStart] = useState(() => addDays(today, -28));
  const [cycleLength, setCycleLength] = useState("28");
  const [periodLength, setPeriodLength] = useState("5");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const count = Number(cycles);
    const cycle = Number(cycleLength);
    const period = Number(periodLength);
    if (![count, cycle, period].every(Number.isInteger) || count < 5 || count > 6 || cycle < 15 || cycle > 60 || period < 1 || period > 14) return null;
    return Array.from({ length: count }, (_, i) => addDays(latestStart, -(count - 1 - i) * cycle));
  }, [cycles, cycleLength, periodLength, latestStart]);

  if (!open) return null;

  async function populate() {
    setError(null);
    setSaved(false);
    const period = Number(periodLength);
    if (!preview || latestStart < earliest || latestStart > today || preview[0] < earliest || addDays(latestStart, period - 1) > today) {
      setError("Choose valid cycle details within the last 12 months.");
      return;
    }

    setSaving(true);
    try {
      for (const start of preview) {
        for (let day = 0; day < period; day++) {
          await saveEntry({
            date: addDays(start, day),
            flow: day === 0 ? "heavy" : day === 1 ? "medium" : "light",
            symptoms: [],
            source: "manual",
          });
        }
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The cycle history could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-lg p-5 shadow-xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="historical-cycle-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Build your baseline</p>
            <h2 id="historical-cycle-title" className="font-display mt-1 text-2xl">Add past cycle history</h2>
            <p className="mt-1 text-sm text-muted">Create period-day entries for the last 5 or 6 cycles so your trends and AI insights have useful history.</p>
          </div>
          <button type="button" className="rounded-full px-2 text-xl text-muted hover:text-text" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Cycles to add">
            <select className="input" value={cycles} onChange={(e) => setCycles(e.target.value)}>
              <option value="5">5 cycles</option>
              <option value="6">6 cycles</option>
            </select>
          </Field>
          <Field label="Most recent period started">
            <input className="input" type="date" min={earliest} max={today} value={latestStart} onChange={(e) => setLatestStart(e.target.value)} />
          </Field>
          <Field label="Cycle length">
            <input className="input" type="number" min={15} max={60} value={cycleLength} onChange={(e) => setCycleLength(e.target.value)} />
          </Field>
          <Field label="Period length">
            <input className="input" type="number" min={1} max={14} value={periodLength} onChange={(e) => setPeriodLength(e.target.value)} />
          </Field>
        </div>

        {preview && <p className="mt-4 text-xs text-muted">This will add period days from {preview[0]} through {preview[preview.length - 1]}. Existing logs on those dates will be updated.</p>}
        {error && <div className="mt-4"><ErrorBox message={error} /></div>}
        {saved && <div className="mt-4"><Notice tone="ok">Past cycle history was added to your encrypted vault.</Notice></div>}

        <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={() => void populate()} loading={saving}>Add cycle history</Button>
        </div>
      </div>
    </div>
  );
}
