// Background backup queue. The UI never waits on it: saving an entry marks it
// pending, and this manager uploads a full encrypted snapshot when enough
// changes pile up, when the connection returns, or when asked.
import { getStorage } from "@/lib/adapters";
import { AUTO_BACKUP_THRESHOLD } from "@/lib/config";
import { getMeta, patchMeta } from "@/lib/vault/db";
import { countPending, listRecords, markBackedUp, subscribeRecords } from "@/lib/vault/records";
import { isUnlocked, requireDk, subscribeSession } from "@/lib/vault/session";
import { publishBackupPointer } from "@/lib/vault/profileSync";
import { withRetry } from "@/lib/util/retry";
import { errMsg } from "@/lib/util/errors";
import { makeBundle, sealBundle } from "./bundle";

export type BackupStatus = {
  state: "idle" | "running" | "error" | "offline";
  pending: number;
  lastBackupAt?: number;
  lastRoot?: string;
  progress?: number;
  label?: string;
  error?: string;
};

let status: BackupStatus = { state: "idle", pending: 0 };
const listeners = new Set<() => void>();
function set(patch: Partial<BackupStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}
export function subscribeBackup(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getBackupStatus(): BackupStatus {
  return status;
}

let running: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export async function refreshBackupStatus() {
  const meta = await getMeta();
  const pending = await countPending().catch(() => 0);
  set({ pending, lastBackupAt: meta?.lastBackup?.at, lastRoot: meta?.lastBackup?.root });
  if (typeof navigator !== "undefined" && !navigator.onLine) set({ state: "offline" });
}

/** Upload a full encrypted snapshot now. Resolves when done (or throws). */
export function backupNow(): Promise<void> {
  if (running) return running;
  if (retryTimer) clearTimeout(retryTimer);
  running = (async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      set({ state: "offline" });
      throw new Error("You're offline. The backup will resume when you reconnect.");
    }
    set({ state: "running", progress: 0, label: "Preparing", error: undefined });
    const snapshotAt = Date.now();
    const [entries, ai, shares] = await Promise.all([listRecords("entries"), listRecords("ai"), listRecords("shares")]);
    const sealed = await sealBundle(requireDk(), makeBundle({ entries, ai, shares }, snapshotAt));
    set({ progress: 0.05, label: "Encrypted" });

    const up = await withRetry(
      () => getStorage().upload(sealed, (f, label) => set({ progress: 0.05 + f * 0.8, label })),
      {
        attempts: 4,
        onRetry: (n) => set({ label: `Connection hiccup, retrying (${n})` }),
        shouldRetry: (e) => (e as { retryable?: boolean }).retryable !== false,
      },
    );
    set({ progress: 0.88, label: "Saving pointer" });
    await patchMeta({ lastBackup: { at: snapshotAt, root: up.root, entryCount: entries.length, size: up.size } });
    await markBackedUp(snapshotAt);
    set({ state: "idle", progress: 1, label: "Backed up", error: undefined });
    await refreshBackupStatus();

    // Synchronize backup pointer to profile in background
    try {
      await publishBackupPointer(up.root, snapshotAt);
    } catch (pointerErr) {
      console.warn("[Backup] Pointer sync notice:", pointerErr);
    }
  })()
    .catch((e: unknown) => {
      const msg = errMsg(e);
      set({ state: navigator.onLine ? "error" : "offline", error: msg, progress: undefined });
      // Try again later on its own.
      retryTimer = setTimeout(() => void maybeAutoBackup(true), 60_000);
      throw e;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** Back up if enough changes are pending (or force when retrying). */
export async function maybeAutoBackup(force = false) {
  if (!isUnlocked() || running) return;
  const pending = await countPending().catch(() => 0);
  set({ pending });
  const meta = await getMeta();
  if (pending === 0) return;
  if (force || pending >= AUTO_BACKUP_THRESHOLD || !meta?.lastBackup) {
    await backupNow().catch(() => undefined);
  }
}

let started = false;
/** Wire up auto-backup triggers (idempotent). */
export function startBackupManager() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    set({ state: "idle" });
    void maybeAutoBackup(true);
  });
  window.addEventListener("offline", () => set({ state: "offline" }));
  let debounce: ReturnType<typeof setTimeout> | null = null;
  subscribeRecords(() => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      void refreshBackupStatus().then(() => maybeAutoBackup(true));
    }, 1500);
  });
  subscribeSession(() => {
    if (isUnlocked()) void refreshBackupStatus().then(() => maybeAutoBackup(true));
  });
  // The vault is usually already unlocked when this starts, so check right away.
  void refreshBackupStatus().then(() => maybeAutoBackup(true));
}
