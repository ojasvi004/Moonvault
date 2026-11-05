// Adapter registry. Real adapters are the default; NEXT_PUBLIC_MOCK_SERVICES=true
// swaps every external service for its mock so the demo survives a testnet outage.
import { MOCK_SERVICES } from "@/lib/config";
import type { AiAdapter, ProfileAdapter, SharesAdapter, StorageAdapter } from "./types";
import { MockAiAdapter, MockArkivAdapter, MockStorageAdapter } from "./mock";
import { ZeroGAiAdapter, ZeroGStorageAdapter } from "./zerog";

export * from "./types";

type Records = ProfileAdapter & SharesAdapter;

let records: Promise<Records> | null = null;
let storage: StorageAdapter | null = null;
let ai: AiAdapter | null = null;

/** Arkiv adapter is lazy-loaded so its SDK stays out of the first-load bundle. */
export function getRecords(): Promise<Records> {
  if (!records) {
    records = MOCK_SERVICES
      ? Promise.resolve(new MockArkivAdapter())
      : import("./arkiv/adapter").then((m) => new m.ArkivAdapter());
  }
  return records;
}

export function getStorage(): StorageAdapter {
  if (!storage) storage = MOCK_SERVICES ? new MockStorageAdapter() : new ZeroGStorageAdapter();
  return storage;
}

export function getAi(): AiAdapter {
  if (!ai) ai = MOCK_SERVICES ? new MockAiAdapter() : new ZeroGAiAdapter();
  return ai;
}
