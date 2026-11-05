"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth, useNow } from "@/components/hooks";
import { Button, Card, ErrorBox, Field, Notice, PageTitle, Spinner, countdown, errMsg } from "@/components/ui";
import { createShare, listActiveShares, revokeShare, whatsappLink, type ActiveShare } from "@/lib/share/share";
import { SCOPE_LABELS, type LocalShare, type ShareScope } from "@/lib/types";

const DURATIONS = [
  { id: "24h", label: "24 hours", ms: 24 * 3600_000 },
  { id: "7d", label: "7 days", ms: 7 * 24 * 3600_000 },
  { id: "custom", label: "Custom", ms: 0 },
] as const;

const SCOPE_HINT: Record<ShareScope, string> = {
  dates: "Period start and end days with flow.",
  dates_symptoms: "Adds symptoms. No mood, sleep or notes.",
  full: "Everything you logged, including notes.",
};

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((m) => m.toDataURL(text, { margin: 1, width: 240, color: { dark: "#0d0a18", light: "#fbf8f4" }, errorCorrectionLevel: "M" }))
      .then((u) => alive && setSrc(u))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [text]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="QR code for the shared link" width={200} height={200} className="rounded-xl" /> : <div className="h-[200px] w-[200px] animate-pulse rounded-xl bg-card-2" />;
}

export default function SharePage() {
  const auth = useAuth();
  const now = useNow(30_000);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<ShareScope>("dates_symptoms");
  const [dur, setDur] = useState<(typeof DURATIONS)[number]["id"]>("7d");
  const [customHours, setCustomHours] = useState("48");
  const [months, setMonths] = useState(6);
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<LocalShare | null>(null);
  const [copied, setCopied] = useState(false);

  const [active, setActive] = useState<ActiveShare[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const address = auth.status === "signedIn" ? auth.address : null;

  const loadList = useCallback(async () => {
    if (!address) return;
    setListErr(null);
    try {
      setActive(await listActiveShares(address));
    } catch (e) {
      setListErr(errMsg(e));
    }
  }, [address]);

  useEffect(() => {
    queueMicrotask(() => void loadList());
  }, [loadList]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const ms = dur === "custom" ? Number(customHours) * 3600_000 : DURATIONS.find((d) => d.id === dur)!.ms;
    if (!Number.isFinite(ms) || ms < 3600_000 || ms > 90 * 24 * 3600_000) return setErr("Choose a duration between 1 hour and 90 days.");
    try {
      const s = await createShare({ recipientLabel: label.trim() || "Shared link", scope, durationMs: ms, months }, setStep);
      setCreated(s);
      void loadList();
    } catch (e) {
      setErr(`Couldn't create the link: ${errMsg(e)}`);
    } finally {
      setStep(null);
    }
  }

  async function revoke(s: ActiveShare) {
    if (!s.local) {
      if (!confirm("Revoke this link now?")) return;
    }
    setRevoking(s.entityKey);
    try {
      await revokeShare(s.local ?? ({ shareId: s.shareId, entityKey: s.entityKey, recipientLabel: "", scope: s.scope, createdAt: s.createdAt, expiresAt: s.expiresAtMs, link: "" } as LocalShare));
      setActive((a) => a?.filter((x) => x.entityKey !== s.entityKey) ?? null);
      if (created?.entityKey === s.entityKey) setCreated(null);
    } catch (e) {
      setListErr(`Couldn't revoke: ${errMsg(e)}`);
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div>
      <PageTitle eyebrow="Shared Access Links" title="Share with your doctor or partner" sub="They open a read-only page, no account needed. The link stops working on its own when time runs out." />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          {created ? (
            <div>
              <h2 className="font-display text-2xl">Your link is ready</h2>
              <p className="mt-1 text-sm text-muted">
                For {created.recipientLabel} · {SCOPE_LABELS[created.scope]} · {countdown(created.expiresAt - now)}
              </p>
              <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                <Qr text={created.link} />
                <div className="w-full min-w-0 space-y-3">
                  <input readOnly className="input font-mono text-xs" value={created.link} onFocus={(e) => e.currentTarget.select()} aria-label="Shared link" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        void navigator.clipboard?.writeText(created.link);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                    >
                      {copied ? "Copied ✓" : "Copy link"}
                    </Button>
                    <a href={whatsappLink(created.link)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#25d366] px-5 font-semibold text-[#06260f]">
                      Share via WhatsApp
                    </a>
                  </div>
                  <Notice>The secret part of the link (after #) never reaches any server. Anyone with the full link can view it until it expires.</Notice>
                  <Button variant="ghost" onClick={() => setCreated(null)}>
                    Create another
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <Field label="Who is it for?" hint="Only stored on your device, encrypted.">
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Dr. appointment, partner" maxLength={60} />
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">What to share</legend>
                <div className="space-y-2">
                  {(Object.keys(SCOPE_LABELS) as ShareScope[]).map((s) => (
                    <label key={s} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${scope === s ? "border-accent bg-accent/5" : "border-line"}`}>
                      <input type="radio" name="scope" className="mt-1 accent-[#f2a65a]" checked={scope === s} onChange={() => setScope(s)} />
                      <span>
                        <span className="block text-sm font-medium">{SCOPE_LABELS[s]}</span>
                        <span className="block text-xs text-muted">{SCOPE_HINT[s]}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Time span">
                <select className="input" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                  <option value={3}>Last 3 months</option>
                  <option value={6}>Last 6 months</option>
                  <option value={12}>Last 12 months</option>
                </select>
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Link expires after</legend>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.id} type="button" className="chip" aria-pressed={dur === d.id} onClick={() => setDur(d.id)}>
                      {d.label}
                    </button>
                  ))}
                </div>
                {dur === "custom" && (
                  <div className="mt-3 flex items-center gap-2">
                    <input className="input w-28" type="number" min={1} max={2160} value={customHours} onChange={(e) => setCustomHours(e.target.value)} aria-label="Hours" />
                    <span className="text-sm text-muted">hours</span>
                  </div>
                )}
              </fieldset>
              {err && <ErrorBox message={err} />}
              <Button type="submit" loading={!!step} className="w-full">
                {step ? `${step}…` : "Create link"}
              </Button>
            </form>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Active links</h2>
            <button className="text-sm text-muted hover:text-text" onClick={() => void loadList()}>
              Refresh
            </button>
          </div>
          {listErr && (
            <div className="mt-3">
              <ErrorBox message={listErr} onRetry={() => void loadList()} />
            </div>
          )}
          {active === null && !listErr && (
            <div className="mt-4">
              <Spinner small label="Loading…" />
            </div>
          )}
          {active?.length === 0 && <p className="mt-4 text-sm text-muted">No active links. Anything you share will appear here until it expires.</p>}
          <ul className="mt-4 space-y-3">
            {active?.map((s) => (
              <li key={s.entityKey} className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.local?.recipientLabel ?? "Shared link"}</p>
                  <p className="text-xs text-muted">
                    {SCOPE_LABELS[s.scope]} · <span className="text-accent">{countdown(s.expiresAtMs - now)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {s.local?.link && (
                    <button className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-card-2" onClick={() => void navigator.clipboard?.writeText(s.local!.link)}>
                      Copy
                    </button>
                  )}
                  <Button variant="danger" className="min-h-9 px-3 py-1.5 text-xs" loading={revoking === s.entityKey} onClick={() => void revoke(s)}>
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
