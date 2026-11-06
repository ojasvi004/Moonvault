"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { EmailLogin } from "@/components/EmailLogin";
import { PassphraseField } from "@/components/PassphraseField";
import { useAuth } from "@/components/hooks";
import { Button, ErrorBox, Field, Spinner, errMsg } from "@/components/ui";
import { getRecords } from "@/lib/adapters";
import { getMeta } from "@/lib/vault/db";
import { createVault } from "@/lib/vault/vault";
import { restoreFromProfile } from "@/lib/backup/restore";
import { saveHealthProfile } from "@/lib/vault/healthProfile";
import { saveEntry } from "@/lib/vault/entries";
import { addDays, todayISO } from "@/lib/cycle/dates";
import type { Strength } from "@/lib/vault/passphrase";

type Check =
  | { state: "checking" }
  | { state: "local" }
  | { state: "cloud"; root?: string }
  | { state: "new" }
  | { state: "error"; message: string };

const CONDITIONS = [
  "PCOS (Polycystic Ovary Syndrome)",
  "Endometriosis",
  "Thyroid Disorder",
  "Irregular Cycles",
  "Uterine Fibroids",
  "None / Regular",
  "Other",
];

export default function SignupPage() {
  const auth = useAuth();
  const router = useRouter();
  const [check, setCheck] = useState<Check>({ state: "checking" });

  // Creation / restore states
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [restorePass, setRestorePass] = useState("");
  const [strength, setStrength] = useState<Strength | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Onboarding survey step (after password creation)
  const [step, setStep] = useState<"password" | "onboarding">("password");
  const [avgCycle, setAvgCycle] = useState("28");
  const [avgPeriod, setAvgPeriod] = useState("5");
  const [pastCycles, setPastCycles] = useState("5");
  const [lastPeriod, setLastPeriod] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [healthNotes, setHealthNotes] = useState("");

  const address = auth.status === "signedIn" ? auth.address : null;
  const email = auth.status === "signedIn" ? auth.email : undefined;

  useEffect(() => {
    if (!address) return;
    let alive = true;
    (async () => {
      const meta = await getMeta();
      if (meta && meta.owner === address.toLowerCase()) return alive && setCheck({ state: "local" });
      const records = await getRecords();
      const profile = await records.getProfile(address);
      if (!profile) {
        if (alive) setCheck({ state: "new" });
        return;
      }
      if (alive) setCheck({ state: "cloud", root: profile.backupRoot });
    })().catch((e) => alive && setCheck({ state: "error", message: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [address, attempt]);

  // Existing vault on this device: go straight to unlocking it.
  useEffect(() => {
    if (check.state === "local") router.replace("/unlock");
  }, [check.state, router]);

  const onStrength = useCallback((s: Strength | null) => setStrength(s), []);

  async function handleCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!strength?.ok) return setErr(strength?.message ?? "Please choose a stronger password.");
    if (pass !== confirm) return setErr("The two passwords don't match.");
    if (!address) return;

    setBusy(true);
    try {
      await createVault(address, pass);
      // Move to onboarding health survey step
      setStep("onboarding");
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreExisting(e: React.FormEvent) {
    e.preventDefault();
    if (!address || check.state !== "cloud") return;
    setErr(null);
    setBusy(true);
    try {
      const records = await getRecords();
      const profile = await records.getProfile(address);
      if (!profile) throw new Error("No backup record found.");
      await restoreFromProfile(address, profile, restorePass);
      router.replace("/calendar");
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleFinishOnboarding(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const cycleDays = parseInt(avgCycle, 10) || 28;
      const periodDays = parseInt(avgPeriod, 10) || 5;
      const cycleCount = parseInt(pastCycles, 10) || 5;
      const today = todayISO();
      const earliest = addDays(today, -365);
      if (lastPeriod) {
        if (cycleCount < 5 || cycleCount > 6 || lastPeriod < earliest || lastPeriod > today) {
          throw new Error("Choose 5 or 6 cycles and a most recent period date within the last 12 months.");
        }
        if (addDays(lastPeriod, periodDays - 1) > today || addDays(lastPeriod, -(cycleCount - 1) * cycleDays) < earliest) {
          throw new Error("Those cycle details extend outside the available 12-month history window.");
        }
      }

      await saveHealthProfile({
        avgCycleLength: cycleDays,
        avgPeriodLength: periodDays,
        lastPeriodDate: lastPeriod || undefined,
        conditions: selectedConditions,
        notes: healthNotes.trim() || undefined,
      });

      // If user supplied history, seed each period so cycle stats and AI insights
      // have real historical starts immediately after onboarding.
      if (lastPeriod) {
        for (let cycle = 0; cycle < cycleCount; cycle++) {
          const start = addDays(lastPeriod, -(cycleCount - 1 - cycle) * cycleDays);
          for (let day = 0; day < periodDays; day++) {
            await saveEntry({
              date: addDays(start, day),
              flow: day === 0 ? "heavy" : day === 1 ? "medium" : "light",
              symptoms: [],
              source: "manual",
            });
          }
        }
      }

      router.replace("/calendar");
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
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

  if (auth.status === "loading") {
    return (
      <AuthFrame title="Create your vault">
        <Spinner label="Loading…" />
      </AuthFrame>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <AuthFrame
        title="Create your vault"
        sub="Sign in with your email to set up your private vault."
        footer={
          <>
            Already have a vault? <Link className="text-accent" href="/unlock">Open it</Link>
          </>
        }
      >
        <EmailLogin cta="Send me a code" />
      </AuthFrame>
    );
  }

  if (check.state === "checking") {
    return (
      <AuthFrame title="Create your vault">
        <Spinner label="Fetching your wallet and any existing vault…" />
      </AuthFrame>
    );
  }

  if (check.state === "local") {
    return (
      <AuthFrame title="Welcome back" sub="Your vault is already set up on this device.">
        <Spinner label="Opening your existing vault…" />
      </AuthFrame>
    );
  }

  // Autofetched existing cloud wallet
  if (check.state === "cloud") {
    return (
      <AuthFrame
        title="Vault detected"
        sub={`We found an existing cloud backup for ${email ?? "your account"}. Enter your password to restore it instantly.`}
      >
        <form onSubmit={handleRestoreExisting} className="space-y-4">
          <Field label="Your vault password">
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={restorePass}
              onChange={(e) => setRestorePass(e.target.value)}
              placeholder="Enter your password"
              autoFocus
              required
            />
          </Field>
          {err && <ErrorBox message={err} />}
          <Button type="submit" loading={busy} className="w-full" disabled={!restorePass}>
            {busy ? "Restoring vault…" : "Unlock & Restore Vault"}
          </Button>
          <p className="text-center text-xs text-faint">
            Need to start fresh?{" "}
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setCheck({ state: "new" })}
            >
              Create new vault instead
            </button>
          </p>
        </form>
      </AuthFrame>
    );
  }

  if (step === "onboarding") {
    return (
      <AuthFrame
        title="Personalize your cycle"
        sub="Tell us about your cycle history and reproductive health so our private AI can deliver tailored insights."
      >
        <form onSubmit={handleFinishOnboarding} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Average cycle (days)" hint="Usually 21–35 days">
              <input
                className="input"
                type="number"
                min={15}
                max={60}
                value={avgCycle}
                onChange={(e) => setAvgCycle(e.target.value)}
                required
              />
            </Field>
            <Field label="Period length (days)" hint="Usually 3–7 days">
              <input
                className="input"
                type="number"
                min={1}
                max={14}
                value={avgPeriod}
                onChange={(e) => setAvgPeriod(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <p className="text-sm font-semibold">Add your past cycle history</p>
            <p className="mt-1 text-xs text-muted">This creates period-day entries for your recent cycles so AI insights and predictions start with your own history.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Cycles to add" hint="Choose 5 or 6">
                <select className="input" value={pastCycles} onChange={(e) => setPastCycles(e.target.value)}>
                  <option value="5">5 cycles</option>
                  <option value="6">6 cycles</option>
                </select>
              </Field>
              <Field label="Most recent period start" hint="Optional, but recommended">
                <input
                  className="input"
                  type="date"
                  min={addDays(todayISO(), -365)}
                  max={todayISO()}
                  value={lastPeriod}
                  onChange={(e) => setLastPeriod(e.target.value)}
                />
              </Field>
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
            <p className="mt-1 text-xs text-faint">
              This helps AI customize symptom correlations and prediction confidence.
            </p>
          </div>

          <Field label="Additional cycle or health notes" hint="e.g. tracking for fertility, birth control use, etc.">
            <textarea
              className="input min-h-20"
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value)}
              placeholder="Any specifics you'd like your private AI to remember..."
            />
          </Field>

          {err && <ErrorBox message={err} />}

          <Button type="submit" loading={busy} className="w-full">
            {busy ? "Encrypting & saving…" : "Finish & Open Calendar"}
          </Button>
          <p className="text-center text-xs text-faint">
            Everything is encrypted on this device with your password before saving.
          </p>
        </form>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Create your password"
      sub="Your wallet is ready. Now create a password: it encrypts your vault on this device, is never sent anywhere, and cannot be reset."
    >
      {check.state === "error" && (
        <div className="mb-4">
          <ErrorBox message={`We couldn't check for an existing vault (${check.message}).`} onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      )}
      <form onSubmit={handleCreatePassword} className="space-y-5">
        <Field label="Create Password">
          <PassphraseField value={pass} onChange={setPass} onStrength={onStrength} userInputs={email ? [email, email.split("@")[0]] : []} autoFocus />
        </Field>
        <Field label="Confirm Password">
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        {err && <ErrorBox message={err} />}
        <Button type="submit" loading={busy} className="w-full" disabled={!strength?.ok || !confirm}>
          {busy ? "Setting up vault…" : "Continue to cycle profile"}
        </Button>
        <p className="text-center text-xs text-faint">If you forget this password, your encrypted data cannot be recovered.</p>
        <p className="text-center text-xs text-faint">
          Only here to see a partner&apos;s cycle? <Link className="text-accent" href="/partner">Open partner view</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
