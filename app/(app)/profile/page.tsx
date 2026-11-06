"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth, useNow } from "@/components/hooks";
import { Button, Card, ErrorBox, Notice, PageTitle, Spinner } from "@/components/ui";
import { getHealthProfile, saveHealthProfile, type HealthProfile } from "@/lib/vault/healthProfile";
import { listRecords } from "@/lib/vault/records";
import type { LocalShare } from "@/lib/types";

const CONDITIONS = [
  "PCOS (Polycystic Ovary Syndrome)",
  "Endometriosis",
  "Thyroid Disorder",
  "Irregular Cycles",
  "Uterine Fibroids",
  "None / Regular",
  "Other",
];

export default function ProfilePage() {
  const auth = useAuth();
  const now = useNow(60_000);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [shares, setShares] = useState<LocalShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form states
  const [avgCycle, setAvgCycle] = useState("28");
  const [avgPeriod, setAvgPeriod] = useState("5");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [healthNotes, setHealthNotes] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([getHealthProfile(), listRecords("shares")])
      .then(([p, s]) => {
        if (!alive) return;
        if (p) {
          setProfile(p);
          setAvgCycle(String(p.avgCycleLength ?? 28));
          setAvgPeriod(String(p.avgPeriodLength ?? 5));
          setSelectedConditions(p.conditions ?? []);
          setHealthNotes(p.notes ?? "");
        }
        setShares(s);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(String(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    setSaved(false);
    try {
      const cycleDays = parseInt(avgCycle, 10) || 28;
      const periodDays = parseInt(avgPeriod, 10) || 5;
      await saveHealthProfile({
        avgCycleLength: cycleDays,
        avgPeriodLength: periodDays,
        lastPeriodDate: profile?.lastPeriodDate,
        conditions: selectedConditions,
        notes: healthNotes.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  function toggleCondition(cond: string) {
    if (cond === "None / Regular") {
      setSelectedConditions(["None / Regular"]);
      return;
    }
    setSelectedConditions((prev) => {
      const withoutNone = prev.filter((c) => c !== "None / Regular");
      return withoutNone.includes(cond) ? withoutNone.filter((c) => c !== cond) : [...withoutNone, cond];
    });
  }

  function copyAddress() {
    if (auth.status === "signedIn") {
      void navigator.clipboard.writeText(auth.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <Spinner label="Loading health profile…" />
      </div>
    );
  }

  const activeShares = shares.filter((s) => !s.revoked && s.expiresAt > now);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle
        eyebrow="Account & Health Profile"
        title="Your Profile"
        sub="Review your account identity, adjust your encrypted cycle parameters, and monitor who has access to your health data."
      />

      {/* Account & Thirdweb Wallet Details */}
      <Card>
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="font-display text-xl">Identity & Wallet</h2>
            <p className="text-xs text-muted">Powered by thirdweb in-app MPC wallet</p>
          </div>
          <span className="rounded-full bg-ok/10 px-3 py-1 text-xs font-semibold text-ok">
            Encrypted Device EOA
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <span className="text-xs text-faint">Account Email</span>
            <p className="font-medium text-text">
              {auth.status === "signedIn" ? auth.email ?? "Anonymous" : "Not connected"}
            </p>
          </div>
          <div>
            <span className="text-xs text-faint">Wallet Address</span>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-muted break-all">
                {auth.status === "signedIn" ? auth.address : "—"}
              </p>
              {auth.status === "signedIn" && (
                <button
                  type="button"
                  onClick={copyAddress}
                  className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:text-text"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Health Profile Editor */}
      <Card>
        <div className="border-b border-line pb-4">
          <h2 className="font-display text-xl">Cycle & Reproductive Health Profile</h2>
          <p className="text-xs text-muted">
            Stored only in your encrypted vault. Used to refine cycle predictions and personalize AI insights.
          </p>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                Average cycle length (days)
              </label>
              <input
                className="input"
                type="number"
                min={15}
                max={60}
                value={avgCycle}
                onChange={(e) => setAvgCycle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                Average period duration (days)
              </label>
              <input
                className="input"
                type="number"
                min={1}
                max={14}
                value={avgPeriod}
                onChange={(e) => setAvgPeriod(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              Reproductive or hormonal conditions affecting your cycle
            </label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((cond) => {
                const isSelected = selectedConditions.includes(cond);
                return (
                  <button
                    key={cond}
                    type="button"
                    className={`chip ${isSelected ? "border-accent bg-accent/10 text-accent font-semibold" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleCondition(cond)}
                  >
                    {cond}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Additional notes for AI analysis
            </label>
            <textarea
              className="input min-h-24"
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value)}
              placeholder="e.g. tracking for fertility, spotting before periods, medication notes..."
            />
          </div>

          {err && <ErrorBox message={err} />}
          {saved && <Notice tone="ok">Health profile encrypted and updated successfully.</Notice>}

          <Button type="submit" loading={saving}>
            {saving ? "Encrypting changes…" : "Save health profile"}
          </Button>
        </form>
      </Card>

      {/* Data Sharing Transparency Section */}
      <Card>
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="font-display text-xl">Active Data Sharing</h2>
            <p className="text-xs text-muted">
              Complete visibility into who has access to your encrypted health logs
            </p>
          </div>
          <Link href="/share" className="text-sm font-medium text-accent hover:underline">
            Manage shares & links →
          </Link>
        </div>

        {activeShares.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            You are not currently sharing your health data with anyone. All records remain locked inside your device vault.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-line">
            {activeShares.map((s) => (
              <div key={s.shareId} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-text">{s.recipientLabel || "Shared Access Link"}</p>
                  <p className="text-xs text-muted">
                    Scope: <span className="capitalize">{s.scope.replace("_", " ")}</span> · Expires:{" "}
                    {new Date(s.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="self-start rounded-full bg-accent/15 px-2.5 py-0.5 text-xs text-accent sm:self-auto">
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
