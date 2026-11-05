// Encrypted CRUD over the IndexedDB stores, plus a small in-memory cache of
// decrypted values that exists only while the vault is unlocked.
import { CTX, decryptJson, encryptJson } from "@/lib/crypto";
import { getDb, type SealedRecord, type StoreName } from "./db";
import { requireDk, subscribeSession } from "./session";
import type { AiResult, Entry, LocalShare } from "@/lib/types";

type ValueOf = { entries: Entry; ai: AiResult; shares: LocalShare };

type Cache = { [K in StoreName]: Map<string, ValueOf[K]> | null };
const cache: Cache = { entries: null, ai: null, shares: null };

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
function emit() {
  version++;
  listeners.forEach((l) => l());
}
export function subscribeRecords(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getRecordsVersion() {
  return version;
}

// Drop decrypted data from memory whenever the vault locks or the key changes.
subscribeSession(() => {
  cache.entries = cache.ai = cache.shares = null;
  emit();
});

const ctxFor = (store: StoreName) => (store === "entries" ? CTX.entry : CTX.meta);

async function load<S extends StoreName>(store: S): Promise<Map<string, ValueOf[S]>> {
  const existing = cache[store] as Map<string, ValueOf[S]> | null;
  if (existing) return existing;
  const dk = requireDk();
  const db = await getDb();
  const rows = await db.getAll(store);
  const map = new Map<string, ValueOf[S]>();
  for (const r of rows) {
    if (r.deleted) continue;
    map.set(r.id, await decryptJson<ValueOf[S]>(dk, r.ct, ctxFor(store)));
  }
  (cache as Record<StoreName, unknown>)[store] = map;
  return map;
}

export async function listRecords<S extends StoreName>(store: S): Promise<ValueOf[S][]> {
  return [...(await load(store)).values()];
}

export async function putRecord<S extends StoreName>(store: S, id: string, value: ValueOf[S]): Promise<void> {
  const dk = requireDk();
  const ct = await encryptJson(dk, value, ctxFor(store));
  const rec: SealedRecord = { id, ct, updatedAt: Date.now(), backedUp: false };
  await (await getDb()).put(store, rec);
  (await load(store)).set(id, value);
  emit();
}

export async function deleteRecord(store: StoreName, id: string): Promise<void> {
  const dk = requireDk();
  // Tombstone so the next backup knows something changed.
  const ct = await encryptJson(dk, {}, ctxFor(store));
  await (await getDb()).put(store, { id, ct, updatedAt: Date.now(), backedUp: false, deleted: true });
  (await load(store)).delete(id);
  emit();
}

/** Bulk write used by restore. Values are re-encrypted with the current DK. */
export async function importRecords<S extends StoreName>(store: S, values: Array<{ id: string; value: ValueOf[S] }>): Promise<void> {
  const dk = requireDk();
  const sealed: SealedRecord[] = [];
  for (const v of values) {
    sealed.push({ id: v.id, ct: await encryptJson(dk, v.value, ctxFor(store)), updatedAt: Date.now(), backedUp: true });
  }
  const db = await getDb();
  const tx = db.transaction(store, "readwrite");
  for (const r of sealed) await tx.store.put(r);
  await tx.done;
  cache[store] = null;
  emit();
}

// ------------------------------------------------------------ backup queue

export async function countPending(): Promise<number> {
  const db = await getDb();
  let n = 0;
  for (const store of ["entries", "ai", "shares"] as const) {
    const all = await db.getAll(store);
    n += all.filter((r) => !r.backedUp).length;
  }
  return n;
}

/** Mark records changed at or before `upTo` as backed up; purge tombstones. */
export async function markBackedUp(upTo: number): Promise<void> {
  const db = await getDb();
  for (const store of ["entries", "ai", "shares"] as const) {
    const tx = db.transaction(store, "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      const r = cursor.value;
      if (!r.backedUp && r.updatedAt <= upTo) {
        if (r.deleted) await cursor.delete();
        else await cursor.update({ ...r, backedUp: true });
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  }
  emit();
}

/** Clear the in-memory cache (tests). */
export function _clearCache() {
  cache.entries = cache.ai = cache.shares = null;
}
