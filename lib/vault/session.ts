// In-memory unlock state. The DK lives only here, only while unlocked.
import { memzero } from "@/lib/crypto";
import { AUTO_LOCK_MS } from "@/lib/config";

type Listener = () => void;

let dk: Uint8Array | null = null;
let lockTimer: ReturnType<typeof setTimeout> | null = null;
let version = 0;
const listeners = new Set<Listener>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribeSession(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getSessionVersion(): number {
  return version;
}

export function isUnlocked(): boolean {
  return dk !== null;
}

/** Take ownership of a freshly unwrapped DK. */
export function setDk(key: Uint8Array) {
  if (dk) void memzero(dk);
  dk = key;
  touch();
  emit();
}

/** Returns the live DK. Callers must not keep a reference after use. */
export function requireDk(): Uint8Array {
  if (!dk) throw new LockedError();
  return dk;
}

export class LockedError extends Error {
  constructor() {
    super("Your vault is locked.");
    this.name = "LockedError";
  }
}

export function lock() {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = null;
  if (dk) {
    void memzero(dk);
    dk = null;
    emit();
  }
}

/** Reset the inactivity timer. */
export function touch() {
  if (!dk) return;
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(lock, AUTO_LOCK_MS);
}

let activityBound = false;
/** Wire up browser activity listeners for auto-lock (idempotent). */
export function bindAutoLock() {
  if (activityBound || typeof window === "undefined") return;
  activityBound = true;
  let last = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - last > 5_000) {
      last = now;
      touch();
    }
  };
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) {
    window.addEventListener(ev, onActivity, { passive: true });
  }
  // When the tab is hidden for longer than the lock window, lock on return.
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS) lock();
  });
}
