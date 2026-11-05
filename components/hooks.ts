"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getAuth, restoreSession, subscribeAuth, type AuthState } from "@/lib/auth/auth";
import { getBackupStatus, subscribeBackup, type BackupStatus } from "@/lib/backup/manager";
import { getRecordsVersion, listRecords, subscribeRecords } from "@/lib/vault/records";
import { getSessionVersion, isUnlocked, subscribeSession } from "@/lib/vault/session";
import type { AiResult, Entry, LocalShare } from "@/lib/types";

const LOADING: AuthState = { status: "loading" };

export function useAuth(): AuthState {
  const s = useSyncExternalStore(subscribeAuth, getAuth, () => LOADING);
  useEffect(() => {
    void restoreSession();
  }, []);
  return s;
}

export function useUnlocked(): boolean {
  useSyncExternalStore(subscribeSession, getSessionVersion, () => 0);
  return typeof window !== "undefined" && isUnlocked();
}

const IDLE: BackupStatus = { state: "idle", pending: 0 };
export function useBackupStatus(): BackupStatus {
  return useSyncExternalStore(subscribeBackup, getBackupStatus, () => IDLE);
}

type StoreValue = { entries: Entry; ai: AiResult; shares: LocalShare };

/** Decrypted records, re-read whenever the store changes. */
export function useRecords<S extends keyof StoreValue>(store: S): { data: StoreValue[S][] | null; error: string | null } {
  const version = useSyncExternalStore(subscribeRecords, getRecordsVersion, () => 0);
  const unlocked = useUnlocked();
  const [state, setState] = useState<{ data: StoreValue[S][] | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    listRecords(store)
      .then((d) => alive && setState({ data: d as StoreValue[S][], error: null }))
      .catch((e: Error) => alive && setState({ data: null, error: e.message }));
    return () => {
      alive = false;
    };
  }, [store, version, unlocked]);
  return state;
}

export function useEntries() {
  const r = useRecords("entries");
  const sorted = r.data ? [...r.data].sort((a, b) => a.date.localeCompare(b.date)) : null;
  return { entries: sorted, error: r.error };
}

/** Ticks every `ms` (for countdowns). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useOnline(): boolean {
  const sub = useCallback((cb: () => void) => {
    window.addEventListener("online", cb);
    window.addEventListener("offline", cb);
    return () => {
      window.removeEventListener("online", cb);
      window.removeEventListener("offline", cb);
    };
  }, []);
  return useSyncExternalStore(sub, () => navigator.onLine, () => true);
}
