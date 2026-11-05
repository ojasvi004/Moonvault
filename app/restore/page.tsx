"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { EmailLogin } from "@/components/EmailLogin";
import { useAuth } from "@/components/hooks";
import { Button, ErrorBox, Field, LinkButton, Notice, ProgressBar, Spinner, errMsg } from "@/components/ui";
import type { ProfileRecord } from "@/lib/adapters";
import { CorruptBackupError } from "@/lib/backup/bundle";
import { NoVaultFoundError, findProfile, restoreFromProfile, type RestoreResult } from "@/lib/backup/restore";
import { WrongPassphraseError } from "@/lib/crypto";
import { signOut } from "@/lib/auth/auth";

type Phase =
  | { k: "finding" }
  | { k: "none" }
  | { k: "findError"; msg: string }
  | { k: "ready"; profile: ProfileRecord }
  | { k: "restoring"; profile: ProfileRecord; p: number; label: string }
  | { k: "failed"; profile: ProfileRecord; msg: string; retryable: boolean }
  | { k: "done"; result: RestoreResult };

export default function RestorePage() {
  const auth = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ k: "finding" });
  const [pass, setPass] = useState("");
  const [passErr, setPassErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const address = auth.status === "signedIn" ? auth.address : null;

  useEffect(() => {
    if (!address) return;
    let alive = true;
    findProfile(address)
      .then((profile) => alive && setPhase({ k: "ready", profile }))
      .catch((e) => alive && setPhase(e instanceof NoVaultFoundError ? { k: "none" } : { k: "findError", msg: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [address, attempt]);

  async function run(profile: ProfileRecord) {
    if (!address) return;
    setPassErr(null);
    setPhase({ k: "restoring", profile, p: 0, label: "Unlocking" });
    try {
      const result = await restoreFromProfile(address, profile, pass, (p, label) => setPhase({ k: "restoring", profile, p, label: label ?? "" }));
      setPass("");
      setPhase({ k: "done", result });
    } catch (e) {
      if (e instanceof WrongPassphraseError) {
        setPassErr("That passphrase didn't unlock this vault. Check it and try again.");
        setPhase({ k: "ready", profile });
      } else if (e instanceof CorruptBackupError) {
        setPhase({ k: "failed", profile, msg: e.message, retryable: true });
      } else {
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setPhase({ k: "failed", profile, msg: offline ? "You're offline. Reconnect and try again." : `The download failed: ${errMsg(e)}`, retryable: true });
      }
    }
  }

  if (auth.status === "loading") {
    return (
      <AuthFrame title="Restore your vault">
        <Spinner label="Loading…" />
      </AuthFrame>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <AuthFrame title="Restore your vault" sub="Sign in with the same email you used before.">
        <EmailLogin cta="Send me a code" />
      </AuthFrame>
    );
  }

  switch (phase.k) {
    case "finding":
      return (
        <AuthFrame title="Restore your vault">
          <Spinner label="Looking for your vault…" />
        </AuthFrame>
      );
    case "none":
      return (
        <AuthFrame title="No vault found" sub={`We couldn't find a vault for ${auth.email ?? "this account"}.`}>
          <div className="space-y-3">
            <LinkButton href="/signup" className="w-full">
              Create a new vault
            </LinkButton>
            <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
              Try a different email
            </Button>
          </div>
        </AuthFrame>
      );
    case "findError":
      return (
        <AuthFrame title="Restore your vault">
          <ErrorBox message={`We couldn't reach your account record: ${phase.msg}`} onRetry={() => setAttempt((a) => a + 1)} />
        </AuthFrame>
      );
    case "done":
      return (
        <AuthFrame title="Your vault is back" sub={phase.result.hadBackup ? `${phase.result.entries} entries restored and re-encrypted on this device.` : "Your vault key was restored. There was no backup yet, so your history starts fresh."}>
          <Button className="w-full" onClick={() => router.replace("/calendar")}>
            Open Moonvault
          </Button>
        </AuthFrame>
      );
    default: {
      const profile = phase.profile;
      const restoring = phase.k === "restoring";
      return (
        <AuthFrame
          title="Restore your vault"
          sub={profile.backupAt ? `Last backup: ${new Date(profile.backupAt).toLocaleString()}` : "This vault has no backup yet; only your key will be restored."}
          footer={<Link href="/unlock">Back</Link>}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(profile);
            }}
            className="space-y-4"
          >
            <Field label="Vault passphrase">
              <input className="input" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} disabled={restoring} autoFocus />
            </Field>
            {passErr && <ErrorBox message={passErr} />}
            {phase.k === "failed" && <ErrorBox message={phase.msg} onRetry={phase.retryable ? () => void run(profile) : undefined} />}
            {restoring && <ProgressBar value={phase.p} label={phase.label} />}
            <Button type="submit" className="w-full" loading={restoring} disabled={!pass}>
              {restoring ? "Restoring…" : "Restore"}
            </Button>
            <Notice>Restoring replaces anything already stored on this device.</Notice>
          </form>
        </AuthFrame>
      );
    }
  }
}
