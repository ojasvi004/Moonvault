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
import { getRecords } from "@/lib/adapters";
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
  // Is there a vault in the account's cloud record? Only checked when this device has none.
  const [cloud, setCloud] = useState<"checking" | "yes" | "no" | "unknown">("checking");

  const address = auth.status === "signedIn" ? auth.address.toLowerCase() : null;
  const hasLocal = !!meta && meta.owner === address;

  useEffect(() => {
    if (!address || meta === undefined || hasLocal) return;
    let alive = true;
    getRecords()
      .then((r) => r.getProfile(address))
      .then((p) => alive && setCloud(p ? "yes" : "no"))
      .catch(() => alive && setCloud("unknown"));
    return () => {
      alive = false;
    };
  }, [address, meta, hasLocal]);

  // No vault anywhere: go straight to creating one.
  useEffect(() => {
    if (cloud === "no" && !hasLocal) router.replace("/signup");
  }, [cloud, hasLocal, router]);

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

  if (!hasLocal) {
    if (cloud === "checking" || cloud === "no") {
      return (
        <AuthFrame title="Unlock your vault">
          <Spinner label="Looking for your vault…" />
        </AuthFrame>
      );
    }
    return (
      <AuthFrame
        title={cloud === "yes" ? "Your vault isn't on this device yet" : "No vault on this device"}
        sub={cloud === "yes" ? "Restore it from your encrypted cloud backup with your passphrase." : "We couldn't check your account right now. Restore your vault, or create a new one."}
        footer={
          <>
            Here to see a partner&apos;s cycle? <Link className="text-accent" href="/partner">Open partner view</Link>
          </>
        }
      >
        <div className="space-y-3">
          <LinkButton href="/restore" className="w-full">
            Restore my vault
          </LinkButton>
          {cloud === "unknown" && (
            <LinkButton href="/signup" variant="ghost" className="w-full">
              Create a new vault
            </LinkButton>
          )}
          <button className="w-full text-center text-xs text-faint hover:text-text" onClick={() => void signOut()}>
            Use a different account
          </button>
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
        <Field label="Vault password">
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
