"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { EmailLogin } from "@/components/EmailLogin";
import { useAuth, useUnlocked } from "@/components/hooks";
import { Button, ErrorBox, Field, LinkButton, Spinner, errMsg } from "@/components/ui";
import { WrongPassphraseError } from "@/lib/crypto";
import { signOut } from "@/lib/auth/auth";
import { getMeta, type VaultMeta } from "@/lib/vault/db";
import { unlockVault } from "@/lib/vault/vault";

function safeNext(): string {
  if (typeof window === "undefined") return "/calendar";
  const n = new URLSearchParams(window.location.search).get("next") ?? "/calendar";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/calendar";
}

export default function UnlockPage() {
  const auth = useAuth();
  const unlocked = useUnlocked();
  const router = useRouter();
  const [meta, setMeta] = useState<VaultMeta | null | undefined>(undefined);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getMeta()
      .then((m) => setMeta(m ?? null))
      .catch(() => setMeta(null));
  }, []);

  useEffect(() => {
    if (unlocked && auth.status === "signedIn") router.replace(safeNext());
  }, [unlocked, auth.status, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await unlockVault(pass);
      setPass("");
    } catch (e) {
      setErr(e instanceof WrongPassphraseError ? "That passphrase didn't unlock your vault. Check it and try again." : errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (auth.status === "loading" || meta === undefined) {
    return (
      <AuthFrame title="Unlock your vault">
        <Spinner label="Loading…" />
      </AuthFrame>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <AuthFrame
        title="Welcome back"
        sub="Sign in with your email to open your vault."
        footer={
          <>
            New here? <Link className="text-accent" href="/signup">Create a vault</Link>
          </>
        }
      >
        <EmailLogin cta="Send me a code" />
      </AuthFrame>
    );
  }

  if (!meta || meta.owner !== auth.address.toLowerCase()) {
    return (
      <AuthFrame title="No vault on this device" sub="Restore your vault from your encrypted cloud backup, or create a new one.">
        <div className="space-y-3">
          <LinkButton href="/restore" className="w-full">
            Restore my vault
          </LinkButton>
          <LinkButton href="/signup" variant="ghost" className="w-full">
            Create a new vault
          </LinkButton>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Unlock your vault"
      sub={auth.email ? `Signed in as ${auth.email}` : undefined}
      footer={
        <button className="hover:text-text" onClick={() => void signOut()}>
          Use a different account
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Vault passphrase">
          <input className="input" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
        </Field>
        {err && <ErrorBox message={err} />}
        <Button type="submit" loading={busy} className="w-full" disabled={!pass}>
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
        <p className="text-center text-xs text-faint">Your data is decrypted only on this device and locks itself after a few minutes away.</p>
      </form>
    </AuthFrame>
  );
}
