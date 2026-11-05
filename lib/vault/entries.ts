import type { Entry } from "@/lib/types";
import { deleteRecord, listRecords, putRecord } from "./records";

export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function listEntries(): Promise<Entry[]> {
  const all = await listRecords("entries");
  return all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
}

/** One entry per day: saving a date that already has an entry replaces it. */
export async function saveEntry(input: Omit<Entry, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Entry> {
  const existing = (await listRecords("entries")).find((e) => e.id === input.id || e.date === input.date);
  const now = Date.now();
  const entry: Entry = {
    ...input,
    id: existing?.id ?? input.id ?? newId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await putRecord("entries", entry.id, entry);
  return entry;
}

export async function removeEntry(id: string): Promise<void> {
  await deleteRecord("entries", id);
}
