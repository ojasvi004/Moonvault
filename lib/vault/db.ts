// IndexedDB layout. Every health-related value is stored only as ciphertext
// (sealed with the DK). The `meta` store holds the *wrapped* DK and sync
// bookkeeping, never the passphrase, KEK or plain DK.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { WrappedDk } from "@/lib/crypto";

export type SealedRecord = {
  id: string;
  ct: Uint8Array; // version || nonce || ciphertext
  updatedAt: number;
  backedUp: boolean; // 0 = pending in the backup queue
  deleted?: boolean; // tombstone (ciphertext of {}), kept until next backup
};

export type VaultMeta = {
  id: "vault";
  owner: string; // account address (public identifier, not health data)
  wrapped: WrappedDk;
  createdAt: number;
  profileSynced: boolean; // wrapped DK pushed to the cloud profile record
  profileKey?: string;
  lastBackup?: { at: number; root: string; entryCount: number; size: number };
  lastProfileExtendAt?: number;
};

interface MoonvaultDB extends DBSchema {
  meta: { key: string; value: VaultMeta };
  entries: { key: string; value: SealedRecord };
  ai: { key: string; value: SealedRecord };
  shares: { key: string; value: SealedRecord };
}

export type StoreName = "entries" | "ai" | "shares";

const DB_NAME = "moonvault";
let dbPromise: Promise<IDBPDatabase<MoonvaultDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<MoonvaultDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MoonvaultDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore("meta", { keyPath: "id" });
        db.createObjectStore("entries", { keyPath: "id" });
        db.createObjectStore("ai", { keyPath: "id" });
        db.createObjectStore("shares", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function getMeta(): Promise<VaultMeta | undefined> {
  return (await getDb()).get("meta", "vault");
}

export async function putMeta(meta: VaultMeta): Promise<void> {
  await (await getDb()).put("meta", meta);
}

export async function patchMeta(patch: Partial<VaultMeta>): Promise<VaultMeta | undefined> {
  const db = await getDb();
  const cur = await db.get("meta", "vault");
  if (!cur) return undefined;
  const next = { ...cur, ...patch, id: "vault" as const };
  await db.put("meta", next);
  return next;
}

/** Wipe everything on this device (used before a restore or by "forget this device"). */
export async function wipeLocalVault(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["meta", "entries", "ai", "shares"], "readwrite");
  await Promise.all([
    tx.objectStore("meta").clear(),
    tx.objectStore("entries").clear(),
    tx.objectStore("ai").clear(),
    tx.objectStore("shares").clear(),
    tx.done,
  ]);
}

/** Reset the cached connection (tests). */
export function _resetDbForTests() {
  dbPromise = null;
}
