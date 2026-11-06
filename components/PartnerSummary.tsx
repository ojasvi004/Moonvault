"use client";
import { diffDays, formatDate, todayISO } from "@/lib/cycle/dates";
import { PHASE_PARTNER_COPY, partnerToday, type PartnerPackage } from "@/lib/partner/partner";
import { timeAgo } from "./ui";

const MOOD_LABEL: Record<string, string> = { great: "😄 Great", good: "🙂 Good", okay: "😐 Okay", low: "😔 Low", bad: "😣 Rough" };

/** The limited cycle summary a partner sees. */
export function PartnerSummary({ pkg, preview = false }: { pkg: PartnerPackage; preview?: boolean }) {
  const today = todayISO();
  const now = partnerToday(pkg, today);
  const next = pkg.upcoming.find((p) => p.start > today) ?? (pkg.next && pkg.next.start >= today ? { start: pkg.next.start, end: pkg.next.end } : undefined);
  const days = next ? diffDays(today, next.start) : null;
  const phase = now.onPeriod ? "menstrual" : now.phase;
  const copy = phase ? PHASE_PARTNER_COPY[phase] : null;
  const fertile = pkg.next && pkg.next.fertileEnd >= today ? pkg.next : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted">{pkg.ownerName}&apos;s cycle</p>
          <p className="font-display mt-1 text-3xl sm:text-4xl">
            {now.onPeriod ? "On their period" : copy ? copy.title : "Not enough data yet"}
            {now.cycleDay && !preview ? <span className="ml-2 text-lg text-muted">· day {now.cycleDay}</span> : null}
          </p>
        </div>
        {!preview && <p className="text-xs text-faint">Updated {timeAgo(pkg.updatedAt)}</p>}
      </div>

      {!preview && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-rose/10 p-4">
              <p className="text-xs text-rose">Next period (estimate)</p>
              {next && days !== null ? (
                <>
                  <p className="font-display mt-1 text-2xl">{days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : "today"}</p>
                  <p className="text-sm text-muted">Around {formatDate(next.start, { weekday: "short", day: "numeric", month: "short" })}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">{now.onPeriod ? "Happening now" : "Not enough data yet"}</p>
              )}
            </div>
            <div className="rounded-2xl bg-lav-soft p-4">
              <p className="text-xs text-lav">Fertile window (estimate)</p>
              {fertile ? (
                <>
                  <p className="font-display mt-1 text-2xl">
                    {formatDate(fertile.fertileStart)} – {formatDate(fertile.fertileEnd)}
                  </p>
                  <p className="text-sm text-muted">Ovulation around {formatDate(fertile.ovulation)}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted">Not enough data yet</p>
              )}
            </div>
          </div>

          {pkg.mood && (
            <p className="mt-4 text-sm">
              <span className="text-muted">Mood logged {pkg.mood.date === today ? "today" : formatDate(pkg.mood.date, { weekday: "long" })}:</span> {MOOD_LABEL[pkg.mood.mood] ?? pkg.mood.mood}
            </p>
          )}

          {copy && <p className="mt-4 rounded-2xl bg-accent/10 p-4 text-sm">{copy.tip}</p>}

          <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-xs text-muted">avg cycle</dt>
              <dd className="font-display text-xl">{pkg.avgCycle} d</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">avg period</dt>
              <dd className="font-display text-xl">{pkg.avgPeriod} d</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">confidence</dt>
              <dd className="font-display text-xl capitalize">{pkg.confidence}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-faint">
            Estimates only. Not medical advice, and not reliable as contraception. {pkg.ownerName} chooses what is shared and can stop sharing at any time.
          </p>
        </>
      )}
    </div>
  );
}
