// Adapter interfaces. Every external service has a real and a mock
// implementation; NEXT_PUBLIC_MOCK_SERVICES=true selects the mocks.
import type { WrappedDk } from "@/lib/crypto";
import type { ShareScope } from "@/lib/types";
import type { Account } from "viem";

export type Progress = (fraction: number, label?: string) => void;

// ------------------------------------------------------------- storage (0G)

export type UploadResult = { root: string; txHash?: string; size: number };

export interface StorageAdapter {
  readonly name: string;
  upload(bytes: Uint8Array, onProgress?: Progress): Promise<UploadResult>;
  download(root: string, onProgress?: Progress): Promise<Uint8Array>;
}

// ------------------------------------------------------------- Arkiv records

/** Public profile record. Contains no health data: only the wrapped key and a backup pointer. */
export type ProfileRecord = {
  entityKey: string;
  owner: string;
  wrapped: WrappedDk;
  backupRoot?: string;
  backupAt?: number;
  expiresAtBlock?: bigint;
  expiresAtMs?: number;
};

export type ProfileWrite = {
  wrapped: WrappedDk;
  backupRoot?: string;
  backupAt?: number;
};

export interface ProfileAdapter {
  readonly name: string;
  getProfile(owner: string): Promise<ProfileRecord | null>;
  /** Creates the record or patches the existing one (owned by signer). */
  saveProfile(signer: Account, data: ProfileWrite, existingKey?: string): Promise<{ entityKey: string; txHash?: string }>;
  /** Pushes the expiry to the maximum allowed lifetime. */
  extendProfile(signer: Account, entityKey: string): Promise<{ txHash?: string }>;
}

/** Public share record. Payload is ciphertext sealed with a key only the link holder has. */
export type ShareRecord = {
  entityKey: string;
  owner: string;
  shareId: string;
  scope: ShareScope;
  createdAt: number;
  expiresAtMs: number;
  payload?: Uint8Array; // inline ciphertext
  pointer?: string; // 0G root hash when the package is too large to inline
  expiresAtBlock?: bigint;
};

export type ShareWrite = {
  shareId: string;
  scope: ShareScope;
  createdAt: number;
  expiresAtMs: number;
  payload?: Uint8Array;
  pointer?: string;
};

export interface SharesAdapter {
  readonly name: string;
  /** Max bytes allowed inline in a share record. */
  readonly maxInlineBytes: number;
  createShare(signer: Account, data: ShareWrite): Promise<{ entityKey: string; txHash?: string }>;
  /** Returns null if the share does not exist, was revoked, or has expired. */
  getShare(shareId: string): Promise<ShareRecord | null>;
  listShares(owner: string): Promise<ShareRecord[]>;
  revokeShare(signer: Account, entityKey: string): Promise<{ txHash?: string }>;
}

// ------------------------------------------------------------- AI (0G PC)

export type AiTask = "ask" | "insights" | "summary" | "structure";

export type AiResponse = {
  text: string;
  requestId: string;
  model: string;
  mock?: boolean;
};

export type TranscribeResponse = AiResponse;

export interface AiAdapter {
  readonly name: string;
  transcribe(audio: Blob, signal?: AbortSignal): Promise<TranscribeResponse>;
  run(task: AiTask, input: unknown, signal?: AbortSignal): Promise<AiResponse>;
}
