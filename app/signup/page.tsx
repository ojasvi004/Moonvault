"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { EmailLogin } from "@/components/EmailLogin";
import { PassphraseField } from "@/components/PassphraseField";
import { useAuth } from "@/components/hooks";
import { Button, ErrorBox, Field, LinkButton, Notice, Spinner, errMsg } from "@/components/ui";
import { getRecords } from "@/lib/adapters";
import { getMeta } from "@/lib/vault/db";
import { createVault } from "@/lib/vault/vault";
import type { Strength } from "@/lib/vault/passphrase";

type Check = { state: "checking" } | { state: "local" } | { state: "cloud" } | { state: "new" } | { state: "error"; message: string };

export default function SignupPage() {
  const auth = useAuth();
  const router = useRouter();
  const [check, setCheck] = useState<Check>({ state: "checking" });
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [strength, setStrength] = useState<Strength | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
      if (alive) setCheck(profile ? { state: "cloud" } : { state: "new" });
    })().catch((e) => alive && setCheck({ state: "error", message: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [address, attempt]);

  const onStrength = useCallback((s: Strength | null) => setStrength(s), []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!strength?.ok) return setErr("Please choose a stronger passphrase.");
    if (pass !== confirm) return setErr("The two passphrases don't match.");
    if (!address) return;
    setBusy(true);
    try {
      await createVault(address, pass);
      setPass("");
      setConfirm("");
      router.replace("/calendar");
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
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
        sub="Step 1 of 2 · Sign in with your email."
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
        <Spinner label="Checking your account…" />
      </AuthFrame>
    );
  }

  if (check.state === "local" || check.state === "cloud") {
    return (
      <AuthFrame title="Welcome back" sub={check.state === "local" ? "This device already has your vault." : "Your account already has a vault. Restore it on this device."}>
        <LinkButton href={check.state === "local" ? "/unlock" : "/restore"} className="w-full">
          {check.state === "local" ? "Unlock my vault" : "Restore my vault"}
        </LinkButton>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Set your vault passphrase" sub="Step 2 of 2 · This passphrase encrypts your data on this device. We never see it and can't reset it.">
      {check.state === "error" && (
        <div className="mb-4">
          <ErrorBox message={`We couldn't check for an existing vault (${check.message}).`} onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      )}
      <form onSubmit={create} className="space-y-5">
        <Field label="Vault passphrase">
          <PassphraseField value={pass} onChange={setPass} onStrength={onStrength} userInputs={email ? [email, email.split("@")[0]] : []} autoFocus />
        </Field>
        <Field label="Type it again">
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Notice>
          <strong>Why so strong?</strong> A locked copy of your key is kept in a public cloud record so you can restore on any device, so a weak
          passphrase could be guessed offline.
        </Notice>
        {err && <ErrorBox message={err} />}
        <Button type="submit" loading={busy} className="w-full" disabled={!strength?.ok || !confirm}>
          {busy ? "Creating your vault…" : "Create my vault"}
        </Button>
        <p className="text-center text-xs text-faint">If you forget this passphrase, your data cannot be recovered.</p>
      </form>
    </AuthFrame>
  );
}
