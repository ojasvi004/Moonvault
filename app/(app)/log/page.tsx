"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useEntries } from "@/components/hooks";
import { Button, Card, Disclaimer, ErrorBox, Field, Notice, PageTitle, VerificationId, errMsg } from "@/components/ui";
import { VoiceRecorder, type VoiceResult } from "@/components/VoiceRecorder";
import { addDays, formatDate, todayISO } from "@/lib/cycle/dates";
import { FLOWS, MOODS, SYMPTOMS, type Entry, type Flow, type Mood } from "@/lib/types";
import { removeEntry, saveEntry } from "@/lib/vault/entries";

const FLOW_LABEL: Record<Flow, string> = { none: "None", spotting: "Spotting", light: "Light", medium: "Medium", heavy: "Heavy" };
const MOOD_EMOJI: Record<Mood, string> = { great: "😄", good: "🙂", okay: "😐", low: "😔", bad: "😣" };

type Form = { date: string; flow: Flow; symptoms: string[]; symptomsText: string; mood?: Mood; sleepHours: string; notes: string; source: Entry["source"] };

const blank = (date: string): Form => ({ date, flow: "none", symptoms: [], symptomsText: "", sleepHours: "", notes: "", source: "manual" });

function fromEntry(e: Entry): Form {
  return {
    date: e.date,
    flow: e.flow,
    symptoms: e.symptoms,
    symptomsText: e.symptomsText ?? "",
    mood: e.mood,
    sleepHours: e.sleepHours != null ? String(e.sleepHours) : "",
    notes: e.notes ?? "",
    source: e.source,
  };
}

export default function LogPage() {
  const router = useRouter();
  const today = todayISO();
  const { entries } = useEntries();
  const [date, setDate] = useState(today);
  const [form, setForm] = useState<Form>(blank(today));
  const [voice, setVoice] = useState<VoiceResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // ?date=YYYY-MM-DD (read once, client-side)
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today) queueMicrotask(() => setDate(d));
  }, [today]);

  const existing = useMemo(() => entries?.find((e) => e.date === date), [entries, date]);

  // Load the existing entry for the selected day unless the user is mid-edit.
  useEffect(() => {
    if (touched) return;
    queueMicrotask(() => setForm(existing ? fromEntry(existing) : blank(date)));
  }, [existing, date, touched]);

  const update = (patch: Partial<Form>) => {
    setTouched(true);
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };

  function applyVoice(r: VoiceResult) {
    const d = addDays(today, r.log.dayOffset);
    setDate(d);
    setTouched(true);
    setVoice(r);
    setForm({
      date: d,
      flow: r.log.flow,
      symptoms: r.log.symptoms,
      symptomsText: r.log.symptomsText,
      mood: r.log.mood ?? undefined,
      sleepHours: r.log.sleepHours != null ? String(r.log.sleepHours) : "",
      notes: r.log.notes,
      source: "voice",
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const sleep = form.sleepHours === "" ? undefined : Number(form.sleepHours);
    if (sleep !== undefined && (!Number.isFinite(sleep) || sleep < 0 || sleep > 24)) return setErr("Sleep should be between 0 and 24 hours.");
    try {
      // Encrypted and written locally right away; backup happens in the background.
      await saveEntry({
        id: existing?.id,
        date: form.date,
        flow: form.flow,
        symptoms: form.symptoms,
        symptomsText: form.symptomsText.trim() || undefined,
        mood: form.mood,
        sleepHours: sleep,
        notes: form.notes.trim() || undefined,
        source: form.source,
      });
      setSaved(true);
      setTouched(false);
      setVoice(null);
      setTimeout(() => router.push("/calendar"), 450);
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow={formatDate(date, { weekday: "long", day: "numeric", month: "long" })} title={existing ? "Edit your log" : "How's today?"} />

      <div className="mb-5">
        <VoiceRecorder today={today} onResult={applyVoice} />
      </div>

      {voice && (
        <div className="mb-5">
          <Notice tone="ok">
            <p className="font-medium">Check what we heard, edit anything, then save.</p>
            <p className="mt-1 text-muted">&ldquo;{voice.transcript}&rdquo;</p>
            <VerificationId ids={voice.requestIds} mock={voice.mock} />
            <div className="mt-2">
              <Disclaimer />
            </div>
          </Notice>
        </div>
      )}

      <Card>
        <form onSubmit={save} className="space-y-6">
          <Field label="Date">
            <input
              type="date"
              className="input"
              max={today}
              value={date}
              onChange={(e) => {
                setTouched(false);
                setDate(e.target.value);
              }}
            />
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Flow</legend>
            <div className="grid grid-cols-5 gap-2">
              {FLOWS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={form.flow === f}
                  onClick={() => update({ flow: f })}
                  className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 text-xs transition ${form.flow === f ? "border-rose bg-rose-soft text-text" : "border-line text-muted"}`}
                >
                  <span className="flex gap-0.5" aria-hidden>
                    {Array.from({ length: Math.max(1, FLOWS.indexOf(f)) }, (_, i) => (
                      <span key={i} className={`h-2.5 w-2.5 rounded-full ${f === "none" ? "border border-faint" : "bg-rose"}`} />
                    ))}
                  </span>
                  {FLOW_LABEL[f]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Symptoms</legend>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => {
                const on = form.symptoms.includes(s);
                return (
                  <button key={s} type="button" className="chip capitalize" aria-pressed={on} onClick={() => update({ symptoms: on ? form.symptoms.filter((x) => x !== s) : [...form.symptoms, s] })}>
                    {s}
                  </button>
                );
              })}
            </div>
            <input className="input mt-3" placeholder="Anything else? (optional)" value={form.symptomsText} onChange={(e) => update({ symptomsText: e.target.value })} maxLength={200} />
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Mood</legend>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={form.mood === m}
                  onClick={() => update({ mood: form.mood === m ? undefined : m })}
                  className={`flex flex-col items-center rounded-2xl border py-2.5 text-xs capitalize transition ${form.mood === m ? "border-accent bg-accent/10 text-text" : "border-line text-muted"}`}
                >
                  <span className="text-xl" aria-hidden>
                    {MOOD_EMOJI[m]}
                  </span>
                  {m}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="Sleep (hours)">
            <input className="input" type="number" inputMode="decimal" min={0} max={24} step={0.5} value={form.sleepHours} onChange={(e) => update({ sleepHours: e.target.value })} placeholder="e.g. 7.5" />
          </Field>

          <Field label="Notes" hint="Only you can read this. Avoid names if you plan to use AI insights.">
            <textarea className="input min-h-24" value={form.notes} onChange={(e) => update({ notes: e.target.value })} maxLength={1000} />
          </Field>

          {err && <ErrorBox message={err} />}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {existing ? (
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  if (!confirm("Delete this day's log?")) return;
                  await removeEntry(existing.id);
                  setTouched(false);
                }}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" className="sm:min-w-40">
              {saved ? "Saved ✓" : "Save"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
