// Mock adapters used when NEXT_PUBLIC_MOCK_SERVICES=true. They behave like
// the real services (expiry, ownership, failures on missing data) but keep
// everything in memory, mirrored to localStorage in the browser so a share
// link can be opened in a second tab. Mock mode is single-browser only.
import type { Account } from "viem";
import { fromBase64Url, toBase64Url } from "@/lib/crypto/encoding";
import type {
  AiAdapter,
  AiResponse,
  AiTask,
  ProfileAdapter,
  ProfileRecord,
  ProfileWrite,
  Progress,
  ShareRecord,
  ShareWrite,
  SharesAdapter,
  StorageAdapter,
  TranscribeResponse,
} from "./types";
import { mockAiText } from "@/lib/ai/mockText";

const ls = (): Storage | null => (typeof window !== "undefined" ? window.localStorage : null);

function persisted<T>(key: string, fallback: T): { get(): T; set(v: T): void } {
  let mem = fallback;
  let loaded = false;
  return {
    get() {
      const s = ls();
      if (s) {
        try {
          const raw = s.getItem(key);
          return raw ? (JSON.parse(raw) as T) : fallback;
        } catch {
          return fallback;
        }
      }
      if (!loaded) loaded = true;
      return mem;
    },
    set(v: T) {
      mem = v;
      ls()?.setItem(key, JSON.stringify(v));
    },
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (n = 16) => toBase64Url(crypto.getRandomValues(new Uint8Array(n)));
const fakeHash = () => "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

// ------------------------------------------------------------------ storage

export class MockStorageAdapter implements StorageAdapter {
  readonly name = "mock-storage";
  private blobs = persisted<Record<string, string>>("mv.mock.blobs", {});

  async upload(bytes: Uint8Array, onProgress?: Progress) {
    for (let i = 1; i <= 4; i++) {
      await delay(120);
      onProgress?.(i / 4, "Uploading");
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
    const root = "0x" + Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
    const all = this.blobs.get();
    all[root] = toBase64Url(bytes);
    this.blobs.set(all);
    return { root, txHash: fakeHash(), size: bytes.length };
  }

  async download(root: string, onProgress?: Progress) {
    await delay(150);
    onProgress?.(0.5, "Downloading");
    const b = this.blobs.get()[root];
    if (!b) throw new Error("Backup not found in storage");
    await delay(150);
    onProgress?.(1, "Downloading");
    return fromBase64Url(b);
  }
}

// ------------------------------------------------------------------ Arkiv

type StoredEntity = {
  key: string;
  owner: string;
  type: "profile" | "share";
  expiresAt: number; // ms
  data: Record<string, unknown>;
};

export class MockArkivAdapter implements ProfileAdapter, SharesAdapter {
  readonly name = "mock-arkiv";
  readonly maxInlineBytes = 96 * 1024;
  private store = persisted<StoredEntity[]>("mv.mock.arkiv", []);
  static readonly MAX_LIFETIME_MS = 7_884_000 * 2000;

  private live(): StoredEntity[] {
    const now = Date.now();
    const all = this.store.get();
    const alive = all.filter((e) => e.expiresAt > now); // real expiry: gone after deadline
    if (alive.length !== all.length) this.store.set(alive);
    return alive;
  }

  private write(mut: (all: StoredEntity[]) => void) {
    const all = this.live();
    mut(all);
    this.store.set(all);
  }

  async getProfile(owner: string): Promise<ProfileRecord | null> {
    await delay(80);
    const e = this.live().find((x) => x.type === "profile" && x.owner.toLowerCase() === owner.toLowerCase());
    if (!e) return null;
    const d = e.data as unknown as ProfileWrite;
    return { entityKey: e.key, owner: e.owner, wrapped: d.wrapped, backupRoot: d.backupRoot, backupAt: d.backupAt, expiresAtMs: e.expiresAt };
  }

  async saveProfile(signer: Account, data: ProfileWrite, existingKey?: string) {
    await delay(300);
    let key = existingKey;
    this.write((all) => {
      const cur = existingKey ? all.find((x) => x.key === existingKey) : undefined;
      if (cur) {
        if (cur.owner.toLowerCase() !== signer.address.toLowerCase()) throw new Error("Not the owner");
        cur.data = { ...cur.data, ...data };
      } else {
        key = fakeHash();
        all.push({ key, owner: signer.address, type: "profile", expiresAt: Date.now() + MockArkivAdapter.MAX_LIFETIME_MS, data: { ...data } });
      }
    });
    return { entityKey: key!, txHash: fakeHash() };
  }

  async extendProfile(signer: Account, entityKey: string) {
    await delay(200);
    this.write((all) => {
      const cur = all.find((x) => x.key === entityKey);
      if (!cur) throw new Error("Record not found");
      if (cur.owner.toLowerCase() !== signer.address.toLowerCase()) throw new Error("Not the owner");
      cur.expiresAt = Date.now() + MockArkivAdapter.MAX_LIFETIME_MS;
    });
    return { txHash: fakeHash() };
  }

  async createShare(signer: Account, d: ShareWrite) {
    await delay(300);
    const key = fakeHash();
    this.write((all) =>
      all.push({
        key,
        owner: signer.address,
        type: "share",
        expiresAt: d.expiresAtMs,
        data: { ...d, payload: d.payload ? toBase64Url(d.payload) : undefined },
      }),
    );
    return { entityKey: key, txHash: fakeHash() };
  }

  private toShare(e: StoredEntity): ShareRecord {
    const d = e.data as Omit<ShareWrite, "payload"> & { payload?: string };
    return {
      entityKey: e.key,
      owner: e.owner,
      shareId: d.shareId,
      scope: d.scope,
      createdAt: d.createdAt,
      expiresAtMs: e.expiresAt,
      payload: d.payload ? fromBase64Url(d.payload) : undefined,
      pointer: d.pointer,
    };
  }

  async getShare(shareId: string) {
    await delay(120);
    const e = this.live().find((x) => x.type === "share" && x.data.shareId === shareId);
    return e ? this.toShare(e) : null;
  }

  async listShares(owner: string) {
    await delay(120);
    return this.live()
      .filter((x) => x.type === "share" && x.owner.toLowerCase() === owner.toLowerCase())
      .map((e) => ({ ...this.toShare(e), payload: undefined }));
  }

  async revokeShare(signer: Account, entityKey: string) {
    await delay(250);
    this.write((all) => {
      const i = all.findIndex((x) => x.key === entityKey);
      if (i < 0) return;
      if (all[i].owner.toLowerCase() !== signer.address.toLowerCase()) throw new Error("Not the owner");
      all.splice(i, 1);
    });
    return { txHash: fakeHash() };
  }
}

// ------------------------------------------------------------------ AI

export class MockAiAdapter implements AiAdapter {
  readonly name = "mock-ai";

  async transcribe(_audio: Blob, signal?: AbortSignal): Promise<TranscribeResponse> {
    await delay(600);
    signal?.throwIfAborted();
    return {
      text: "Today my flow is medium, I have cramps and a headache, I slept about six and a half hours and I'm feeling a bit low.",
      requestId: `mock-${rand(9)}`,
      model: "mock-transcriber",
      mock: true,
    };
  }

  async run(task: AiTask, input: unknown, signal?: AbortSignal): Promise<AiResponse> {
    await delay(700);
    signal?.throwIfAborted();
    return { text: mockAiText(task, input), requestId: `mock-${rand(9)}`, model: "mock-model", mock: true };
  }
}
