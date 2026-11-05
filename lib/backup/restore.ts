// One-step restore on a new device.
import { getRecords, getStorage, type ProfileRecord, type Progress } from "@/lib/adapters";
import { importRecords } from "@/lib/vault/records";
import { requireDk } from "@/lib/vault/session";
import { adoptVault } from "@/lib/vault/vault";
import { patchMeta } from "@/lib/vault/db";
import { withRetry } from "@/lib/util/retry";
import { openBundle } from "./bundle";

export class NoVaultFoundError extends Error {
  constructor() {
    super("We couldn't find a vault for this account. If you're new, create one instead.");
    this.name = "NoVaultFoundError";
  }
}

export async function findProfile(address: string): Promise<ProfileRecord> {
  const records = await getRecords();
  const p = await withRetry(() => records.getProfile(address), { attempts: 3 });
  if (!p) throw new NoVaultFoundError();
  return p;
}

export type RestoreResult = { entries: number; hadBackup: boolean; backupAt?: number };

/**
 * Unwrap the DK with the passphrase (throws WrongPassphraseError), then pull the
 * encrypted bundle and re-encrypt its records into IndexedDB.
 */
export async function restoreFromProfile(
  address: string,
  profile: ProfileRecord,
  passphrase: string,
  onProgress?: Progress,
): Promise<RestoreResult> {
  onProgress?.(0.02, "Unlocking");
  await adoptVault(address, profile.wrapped, passphrase, profile.entityKey);
  if (!profile.backupRoot) {
    onProgress?.(1, "No backup yet");
    return { entries: 0, hadBackup: false };
  }
  const bytes = await withRetry(
    () => getStorage().download(profile.backupRoot!, (f, l) => onProgress?.(0.05 + f * 0.8, l)),
    { attempts: 4, onRetry: (n) => onProgress?.(0.05, `Retrying download (${n})`) },
  );
  onProgress?.(0.88, "Decrypting");
  const bundle = await openBundle(requireDk(), bytes); // throws CorruptBackupError
  onProgress?.(0.93, "Saving to this device");
  await importRecords("entries", bundle.data.entries.map((e) => ({ id: e.id, value: e })));
  await importRecords("ai", bundle.data.ai.map((a) => ({ id: a.id, value: a })));
  await importRecords("shares", bundle.data.shares.map((s) => ({ id: s.shareId, value: s })));
  await patchMeta({
    lastBackup: { at: profile.backupAt ?? bundle.createdAt, root: profile.backupRoot, entryCount: bundle.data.entries.length, size: bytes.length },
  });
  onProgress?.(1, "Restored");
  return { entries: bundle.data.entries.length, hadBackup: true, backupAt: profile.backupAt ?? bundle.createdAt };
}
