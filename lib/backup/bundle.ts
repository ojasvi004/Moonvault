// Encrypted backup bundle.
//
//   bytes = "MVB" 0x01 || seal(DK, gzip(JSON(bundle)), "moonvault:backup:v1")
//
// The JSON carries a manifest so later versions can append incremental
// segments that reference a base snapshot (v1 only writes kind:"full").
import { gunzipSync, gzipSync } from "fflate";
import { CTX, DecryptionError, decryptBytes, encryptBytes } from "@/lib/crypto";
import { concatBytes, fromUtf8, utf8 } from "@/lib/crypto/encoding";
import type { AiResult, Entry, LocalShare } from "@/lib/types";

export const MAGIC = new Uint8Array([0x4d, 0x56, 0x42, 0x01]); // "MVB" v1

export type BundleSegment = {
  id: string;
  kind: "full" | "delta";
  createdAt: number;
  base?: string; // root of the snapshot a delta applies to (future)
  counts: { entries: number; ai: number; shares: number };
};

export type Bundle = {
  format: "moonvault.bundle";
  v: 1;
  createdAt: number;
  manifest: { kind: "full"; schema: 1; segments: BundleSegment[] };
  data: { entries: Entry[]; ai: AiResult[]; shares: LocalShare[] };
};

export class CorruptBackupError extends Error {
  constructor(msg = "The backup could not be read. It may be damaged or incomplete.") {
    super(msg);
    this.name = "CorruptBackupError";
  }
}

export function makeBundle(data: Bundle["data"], now = Date.now()): Bundle {
  return {
    format: "moonvault.bundle",
    v: 1,
    createdAt: now,
    manifest: {
      kind: "full",
      schema: 1,
      segments: [
        {
          id: `full-${now}`,
          kind: "full",
          createdAt: now,
          counts: { entries: data.entries.length, ai: data.ai.length, shares: data.shares.length },
        },
      ],
    },
    data,
  };
}

/** Compress first, then encrypt (ciphertext does not compress). */
export async function sealBundle(dk: Uint8Array, bundle: Bundle): Promise<Uint8Array> {
  const json = utf8(JSON.stringify(bundle));
  const gz = gzipSync(json, { level: 9 });
  json.fill(0);
  try {
    return concatBytes(MAGIC, await encryptBytes(dk, gz, CTX.backup));
  } finally {
    gz.fill(0);
  }
}

export async function openBundle(dk: Uint8Array, bytes: Uint8Array): Promise<Bundle> {
  if (bytes.length < MAGIC.length + 41 || !MAGIC.every((b, i) => bytes[i] === b)) {
    throw new CorruptBackupError("This file is not a Moonvault backup, or the download was incomplete.");
  }
  let gz: Uint8Array;
  try {
    gz = await decryptBytes(dk, bytes.subarray(MAGIC.length), CTX.backup);
  } catch (e) {
    if (e instanceof DecryptionError) throw new CorruptBackupError("The backup failed its integrity check (damaged download or a different vault key).");
    throw e;
  }
  let parsed: Bundle;
  try {
    parsed = JSON.parse(fromUtf8(gunzipSync(gz))) as Bundle;
  } catch {
    throw new CorruptBackupError();
  }
  if (parsed.format !== "moonvault.bundle" || parsed.v !== 1 || !parsed.data || !Array.isArray(parsed.data.entries)) {
    throw new CorruptBackupError("Unsupported backup version.");
  }
  parsed.data.ai ??= [];
  parsed.data.shares ??= [];
  return parsed;
}
