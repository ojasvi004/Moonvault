"use client";
import { useState } from "react";
import { sendCode, verifyCode } from "@/lib/auth/auth";
import { Button, ErrorBox, Field, errMsg } from "./ui";

/** Email + one-time code sign-in. */
export function EmailLogin({ cta = "Continue" }: { cta?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("Please enter a valid email address.");
    setBusy(true);
    try {
      await sendCode(email.trim());
      setStep("code");
    } catch (e) {
      setErr(`We couldn't send the code. ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await verifyCode(email.trim(), code);
    } catch (e) {
      setErr(errMsg(e).includes("code") ? errMsg(e) : "That code didn't work. Check it and try again, or request a new one.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "email") {
    return (
      <form onSubmit={submitEmail} className="space-y-4">
        <Field label="Email" hint="We'll email you a 6-digit code. Your wallet is created or fetched automatically. No seed phrase.">
          <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        {err && <ErrorBox message={err} />}
        <Button type="submit" loading={busy} className="w-full">
          {cta}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="space-y-4">
      <Field label={`Code sent to ${email}`}>
        <input
          className="input text-center font-mono text-xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="••••••"
          autoFocus
          required
        />
      </Field>
      {err && <ErrorBox message={err} />}
      <Button type="submit" loading={busy} className="w-full" disabled={code.length !== 6}>
        Verify
      </Button>
      <div className="flex justify-between text-sm text-muted">
        <button type="button" className="hover:text-text" onClick={() => setStep("email")}>
          Change email
        </button>
        <button
          type="button"
          className="hover:text-text"
          onClick={() => {
            setCode("");
            void sendCode(email.trim()).catch((e) => setErr(errMsg(e)));
          }}
        >
          Resend code
        </button>
      </div>
    </form>
  );
}
