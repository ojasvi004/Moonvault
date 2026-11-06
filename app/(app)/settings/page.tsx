"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useBackupStatus, useOnline } from "@/components/hooks";
import { Button, Card, ErrorBox, Notice, PageTitle, ProgressBar, errMsg, timeAgo } from "@/components/ui";
import { signOut } from "@/lib/auth/auth";
import { backupNow } from "@/lib/backup/manager";
import { AUTO_LOCK_MS, MOCK_SERVICES } from "@/lib/config";
import { getMeta, wipeLocalVault, type VaultMeta } from "@/lib/vault/db";
import { syncProfile } from "@/lib/vault/profileSync";
import { lock } from "@/lib/vault/session";

export default function SettingsPage() {
  const auth = useAuth();
  const status = useBackupStatus();
  const online = useOnline();
  const router = useRouter();
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void getMeta().then((m) => setMeta(m ?? null));
  }, [status.lastBackupAt, syncing]);

  async function doBackup() {
    setErr(null);
    try {
      await backupNow();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  async function doSync() {
    setErr(null);
    setSyncing(true);
    try {
      await syncProfile();
    } catch (e) {
      setErr(`Account record sync failed: ${errMsg(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function forget() {
    if (!confirm("Remove the vault from this device? You can restore it later from your Encrypted Cloud Backup. Unsynced changes will be lost.")) return;
    lock();
    await wipeLocalVault();
    await signOut();
    router.replace("/");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Private Vault" title="Your vault" sub={auth.status === "signedIn" ? `Account: ${auth.email ?? "signed in"}` : undefined} />

      <div className="space-y-5">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">Encrypted Cloud Backup</h2>
                <span className="rounded-full bg-ok/15 px-2.5 py-0.5 text-xs text-ok">Automatic</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Nothing to click: a few seconds after every change, your vault is compressed, encrypted on this device and uploaded. If you&apos;re offline or
                something fails, it retries on its own.
              </p>
            </div>
            <Button variant="ghost" className="shrink-0" onClick={() => void doBackup()} loading={status.state === "running"} disabled={!online || status.state === "running"}>
              {status.state === "running" ? "Backing up…" : "Back up now"}
            </Button>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-faint">Last backed up</dt>
              <dd>{status.lastBackupAt ? `${new Date(status.lastBackupAt).toLocaleString()} (${timeAgo(status.lastBackupAt)})` : "Never"}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Waiting to back up</dt>
              <dd className={status.pending ? "text-warn" : ""}>{status.pending} change{status.pending === 1 ? "" : "s"}</dd>
            </div>
            <div>
              <dt className="text-xs text-faint">Connection</dt>
              <dd className={online ? "text-ok" : "text-warn"}>{online ? "Online" : "Offline — will resume"}</dd>
            </div>
            {status.lastRoot && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-faint">Backup Verification ID</dt>
                <dd className="break-all font-mono text-xs text-muted">{status.lastRoot}</dd>
              </div>
            )}
          </dl>
          {status.state === "running" && (
            <div className="mt-4">
              <ProgressBar value={status.progress ?? 0} label={status.label} />
            </div>
          )}
          {status.state === "error" && status.error && (
            <div className="mt-4">
              <Notice tone="warn">Last backup attempt didn&apos;t finish ({status.error}). It will retry automatically; your data is safe on this device meanwhile.</Notice>
            </div>
          )}
          {err && (
            <div className="mt-4">
              <ErrorBox message={err} />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-2xl">Restore key</h2>
          <p className="mt-1 text-sm text-muted">
            A passphrase-locked copy of your vault key is kept with your account so you can restore on any device. It is useless without your passphrase.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs ${meta?.profileSynced ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>{meta?.profileSynced ? "Saved to your account" : "Not saved yet"}</span>
            {!meta?.profileSynced && (
              <Button variant="soft" onClick={() => void doSync()} loading={syncing}>
                Save now
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-2xl">Security</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>• Entries are encrypted on this device with XChaCha20-Poly1305; your key is protected by Argon2id.</li>
            <li>• Your vault locks itself after {Math.round(AUTO_LOCK_MS / 60000)} minutes without activity.</li>
            <li>• AI requests contain only the minimum, anonymized data needed, and show a Verification ID.</li>
          </ul>
          {MOCK_SERVICES && (
            <div className="mt-4">
              <Notice tone="warn">Demo mode is on: cloud backup, account records and AI are simulated on this device.</Notice>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => lock()}>
              Lock now
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                lock();
                await signOut();
                router.replace("/");
              }}
            >
              Sign out
            </Button>
            <Button variant="danger" onClick={() => void forget()}>
              Remove from this device
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
