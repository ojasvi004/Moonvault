"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, useRecords } from "./hooks";
import { Button, Card, ErrorBox, Field, Notice, Spinner, errMsg, timeAgo } from "./ui";
import {
  createPartnerInvite,
  partnerStatus,
  removePartner,
  updatePartnerSettings,
  type PartnerLocal,
  type PartnerStatus,
} from "@/lib/partner/partner";

const SEES = ["Period days and the next predicted period", "Current cycle phase, with a supportive tip", "Estimated fertile window", "Average cycle and period length"];
const NEVER = ["Symptoms", "Notes", "Sleep", "Anything else in your vault"];

function waLink(link: string) {
  return `https://wa.me/?text=${encodeURIComponent(`I'd like to share my cycle with you on Moonvault. Open this link and sign in to connect: ${link}`)}`;
}

/** Owner side of partner sharing (on the Share page). */
export function PartnerCard() {
  const auth = useAuth();
  const { data: shares } = useRecords("shares");
  const links = useMemo(
    () => (shares ?? []).filter((s): s is PartnerLocal => s.kind === "partner" && !s.revoked && !!s.partnerKey && !!s.writeToken),
    [shares],
  );
  const link = links[0];

  const defaultName = auth.status === "signedIn" && auth.email ? auth.email.split("@")[0] : "";
  const [name, setName] = useState("");
  const [mood, setMood] = useState(false);
  const [busy, setBusy] = useState<"create" | "save" | "remove" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<PartnerStatus | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!link) return;
    try {
      setStatus(await partnerStatus(link.shareId));
    } catch {
      setStatus(undefined);
    }
  }, [link]);

  useEffect(() => {
    queueMicrotask(() => void loadStatus());
    if (!link) return;
    // While waiting for the partner, check now and then whether they've joined.
    const t = setInterval(() => void loadStatus(), 15_000);
    return () => clearInterval(t);
  }, [loadStatus, link]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (auth.status !== "signedIn") return;
    setErr(null);
    setBusy("create");
    try {
      await createPartnerInvite(auth.address, { ownerName: name.trim() || defaultName, includeMood: mood });
    } catch (e) {
      setErr(`Couldn't create the invite: ${errMsg(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!link) return;
    setErr(null);
    setBusy("save");
    try {
      await updatePartnerSettings(link, { ownerName: name.trim() || link.ownerName || defaultName, includeMood: mood });
      setEditing(false);
    } catch (e) {
      setErr(`Couldn't update: ${errMsg(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!link || !confirm("Stop sharing with your partner? They will lose access right away.")) return;
    setErr(null);
    setBusy("remove");
    try {
      await removePartner(link);
      setStatus(undefined);
    } catch (e) {
      setErr(`Couldn't remove: ${errMsg(e)}`);
    } finally {
      setBusy(null);
    }
  }

  if (shares === null) {
    return (
      <Card>
        <Spinner small label="Loading partner sharing…" />
      </Card>
    );
  }

  const settings = (
    <div className="space-y-4">
      <Field label="Your name" hint="How you appear to your partner.">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName || "e.g. Priya"} maxLength={40} />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 accent-[#f2a65a]" checked={mood} onChange={(e) => setMood(e.target.checked)} />
        <span>
          Also share my mood
          <span className="block text-xs text-muted">Only the most recent mood you log (from the last 2 days).</span>
        </span>
      </label>
    </div>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Partner sharing</p>
          <h2 className="font-display mt-1 text-2xl">Share with your partner</h2>
        </div>
        {link && (
          <span className={`rounded-full px-3 py-1 text-xs ${status?.claimed ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>
            {status === undefined ? "Checking…" : status === null ? "Removed" : status.claimed ? "Connected" : "Waiting for your partner"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Links your account to your partner&apos;s. Whenever they sign in to Moonvault they see a small, always-up-to-date summary of your cycle. It stays encrypted;
        only the two of you can read it.
      </p>

      {!link ? (
        <form onSubmit={create} className="mt-5 space-y-5">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-line p-3">
              <p className="mb-1 text-xs font-semibold text-ok">They see</p>
              <ul className="space-y-1 text-muted">
                {SEES.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-line p-3">
              <p className="mb-1 text-xs font-semibold text-bad">They never see</p>
              <ul className="space-y-1 text-muted">
                {NEVER.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </div>
          </div>
          {settings}
          {err && <ErrorBox message={err} />}
          <Button type="submit" loading={busy === "create"} className="w-full">
            {busy === "create" ? "Creating invite…" : "Create partner invite"}
          </Button>
        </form>
      ) : (
        <div className="mt-5 space-y-4">
          {!status?.claimed && (
            <>
              <p className="text-sm">Send this invite to your partner. They open it, sign in with their own email, and you&apos;re connected.</p>
              <input readOnly className="input font-mono text-xs" value={link.link} onFocus={(e) => e.currentTarget.select()} aria-label="Partner invite link" />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    void navigator.clipboard?.writeText(link.link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied ✓" : "Copy invite"}
                </Button>
                <a href={waLink(link.link)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#25d366] px-5 font-semibold text-[#06260f]">
                  Send via WhatsApp
                </a>
              </div>
              <Notice>The invite works once: the first account to accept it becomes your partner. If it goes to the wrong person, remove it and create a new one.</Notice>
            </>
          )}
          {status?.claimed && (
            <Notice tone="ok">
              Your partner is connected. Their view updates on its own a few seconds after you log something
              {status.updatedAt ? ` (last update ${timeAgo(status.updatedAt)})` : ""}.
            </Notice>
          )}
          <p className="text-sm text-muted">
            Shown as <strong className="text-text">{link.ownerName || defaultName || "Your partner"}</strong> · mood {link.includeMood ? "shared" : "not shared"}
          </p>
          {editing && settings}
          {err && <ErrorBox message={err} />}
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button variant="soft" loading={busy === "save"} onClick={() => void save()}>
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                onClick={() => {
                  setName(link.ownerName ?? "");
                  setMood(!!link.includeMood);
                  setEditing(true);
                }}
              >
                Change what they see
              </Button>
            )}
            <Button variant="danger" loading={busy === "remove"} onClick={() => void remove()}>
              Stop sharing
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
