"use client";
// Read-only report for the person a link was shared with. No account, no
// wallet: reads the public record, decrypts with the key in the URL fragment.
import { useEffect, useState } from "react";
import { MoonMark, Spinner, countdown } from "@/components/ui";
import { useNow } from "@/components/hooks";
import { formatDate } from "@/lib/cycle/dates";
import { ShareUnavailableError, readShare } from "@/lib/share/share";
import { SCOPE_LABELS, type SharePackage } from "@/lib/types";

type State = { k: "loading" } | { k: "ok"; pkg: SharePackage } | { k: "gone"; msg: string } | { k: "error"; msg: string };

export function DoctorView({ shareId }: { shareId: string }) {
  const [state, setState] = useState<State>({ k: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const key = window.location.hash.slice(1);
    readShare(shareId, key)
      .then(({ pkg }) => alive && setState({ k: "ok", pkg }))
      .catch((e) => {
        if (!alive) return;
        if (e instanceof ShareUnavailableError) setState({ k: "gone", msg: e.message });
        else setState({ k: "error", msg: "We couldn't load this report right now. Check your connection and try again." });
      });
    return () => {
      alive = false;
    };
  }, [shareId, attempt]);

  // Expire live while open.
  useEffect(() => {
    if (state.k !== "ok") return;
    const ms = state.pkg.expiresAt - Date.now();
    const t = setTimeout(() => setState({ k: "gone", msg: "This link has expired." }), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div className="paper min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between border-b border-[#e4dfe9] pb-4">
          <div className="flex items-center gap-2">
            <MoonMark className="h-6 w-6" />
            <span className="font-display text-lg">Moonvault</span>
          </div>
          <span className="text-xs text-[#5b5568]">Read-only shared report</span>
        </header>

        {state.k === "loading" && (
          <div className="py-24 text-center text-[#5b5568]">
            <Spinner label="Opening the encrypted report…" />
          </div>
        )}

        {state.k === "gone" && (
          <div className="py-24 text-center">
            <p className="font-display text-3xl">This link has expired</p>
            <p className="mx-auto mt-3 max-w-md text-[#5b5568]">{state.msg} If you still need access, ask the person who shared it to send a new link.</p>
          </div>
        )}

        {state.k === "error" && (
          <div className="py-24 text-center">
            <p className="font-display text-2xl">Couldn&apos;t load the report</p>
            <p className="mt-2 text-[#5b5568]">{state.msg}</p>
            <button className="mt-6 rounded-full border border-[#cfc7d9] px-5 py-2.5 font-semibold" onClick={() => { setState({ k: "loading" }); setAttempt((a) => a + 1); }}>
              Try again
            </button>
          </div>
        )}

        {state.k === "ok" && <Report pkg={state.pkg} />}
      </div>
    </div>
  );
}

function Report({ pkg }: { pkg: SharePackage }) {
  const now = useNow(30_000);
  const bleeding = pkg.entries.filter((e) => e.flow && e.flow !== "none");
  const symptomCounts = new Map<string, number>();
  for (const e of pkg.entries) for (const s of e.symptoms ?? []) symptomCounts.set(s, (symptomCounts.get(s) ?? 0) + 1);
  const topSymptoms = [...symptomCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <article className="mt-8">
      <h1 className="font-display text-3xl sm:text-4xl">Cycle report</h1>
      <p className="mt-2 text-[#5b5568]">
        {formatDate(pkg.range.from, { day: "numeric", month: "short", year: "numeric" })} – {formatDate(pkg.range.to, { day: "numeric", month: "short", year: "numeric" })} · {SCOPE_LABELS[pkg.scope]}
      </p>
      <p className="mt-1 text-xs text-[#5b5568]">
        Shared {new Date(pkg.createdAt).toLocaleDateString()} · {countdown(pkg.expiresAt - now)}
      </p>

      <section className="mt-8 grid grid-cols-3 gap-3">
        {[
          ["Average cycle", pkg.stats?.avgCycle ? `${pkg.stats.avgCycle} days` : "—"],
          ["Average period", pkg.stats?.avgPeriod ? `${pkg.stats.avgPeriod} days` : "—"],
          ["Bleeding days", String(bleeding.length)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-[#e4dfe9] bg-white p-4">
            <p className="text-xs text-[#5b5568]">{k}</p>
            <p className="font-display mt-1 text-xl sm:text-2xl">{v}</p>
          </div>
        ))}
      </section>

      {topSymptoms.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl">Most frequent symptoms</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {topSymptoms.map(([s, n]) => (
              <li key={s} className="rounded-full border border-[#e4dfe9] bg-white px-3 py-1 text-sm">
                <span className="capitalize">{s}</span> <span className="text-[#5b5568]">· {n} days</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl">Daily log</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[#e4dfe9] bg-white">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-[#5b5568]">
              <tr className="border-b border-[#e4dfe9]">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Flow</th>
                {pkg.scope !== "dates" && <th className="px-4 py-2.5 font-medium">Symptoms</th>}
                {pkg.scope === "full" && <th className="px-4 py-2.5 font-medium">Mood / sleep</th>}
                {pkg.scope === "full" && <th className="px-4 py-2.5 font-medium">Notes</th>}
              </tr>
            </thead>
            <tbody>
              {[...pkg.entries].reverse().map((e) => (
                <tr key={e.date} className="border-b border-[#f0ecf3] last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-2">{formatDate(e.date, { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className={`px-4 py-2 capitalize ${e.flow && e.flow !== "none" ? "text-[#b23a4f] font-medium" : "text-[#5b5568]"}`}>{e.flow === "none" ? "—" : e.flow}</td>
                  {pkg.scope !== "dates" && <td className="px-4 py-2">{[...(e.symptoms ?? []), e.symptomsText].filter(Boolean).join(", ") || "—"}</td>}
                  {pkg.scope === "full" && (
                    <td className="px-4 py-2 capitalize">
                      {e.mood ?? "—"}
                      {e.sleepHours != null ? ` · ${e.sleepHours} h` : ""}
                    </td>
                  )}
                  {pkg.scope === "full" && <td className="px-4 py-2 text-[#5b5568]">{e.notes ?? ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-10 border-t border-[#e4dfe9] pt-4 text-xs text-[#5b5568]">
        Self-reported data shared by the patient. Informational only, not a diagnosis. This page was decrypted in your browser; the link stops working when it expires or is revoked.
        <button onClick={() => window.print()} className="no-print ml-2 underline">
          Print
        </button>
      </footer>
    </article>
  );
}
