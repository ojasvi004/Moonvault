// Background sync of the cloud profile record (wrapped DK + backup pointer).
// Never blocks the UI; failures are retried with backoff.
import { getRecords } from "@/lib/adapters";
import { getSigner } from "@/lib/auth/auth";
import { ensureGas } from "@/lib/auth/gas";
import { getMeta, patchMeta } from "./db";
import { withRetry } from "@/lib/util/retry";

const EXTEND_EVERY_MS = 12 * 60 * 60 * 1000;

let running: Promise<void> | null = null;

/** Push the wrapped DK to the profile record if it is not there yet. */
export function syncProfile(): Promise<void> {
  if (!running) {
    running = (async () => {
      const meta = await getMeta();
      if (!meta) return;
      const records = await getRecords();
      const signer = await getSigner();
      if (signer.address.toLowerCase() !== meta.owner) return;
      if (!meta.profileSynced) {
        await withRetry(async () => {
          await ensureGas(signer.address);
          const existing = await records.getProfile(signer.address);
          const { entityKey } = await records.saveProfile(
            signer,
            { wrapped: meta.wrapped, backupRoot: existing?.backupRoot ?? meta.lastBackup?.root, backupAt: existing?.backupAt ?? meta.lastBackup?.at },
            existing?.entityKey,
          );
          await patchMeta({ profileSynced: true, profileKey: entityKey, lastProfileExtendAt: Date.now() });
        });
        return;
      }
      // Already synced: keep the record alive by extending it on login.
      if (meta.profileKey && Date.now() - (meta.lastProfileExtendAt ?? 0) > EXTEND_EVERY_MS) {
        await withRetry(async () => {
          await ensureGas(signer.address);
          await records.extendProfile(signer, meta.profileKey!);
          await patchMeta({ lastProfileExtendAt: Date.now() });
        }, { attempts: 2 });
      }
    })().finally(() => {
      running = null;
    });
  }
  return running;
}

/** Update the backup pointer on the profile record after a successful upload. */
export async function publishBackupPointer(root: string, at: number): Promise<void> {
  const meta = await getMeta();
  if (!meta) throw new Error("No vault");
  const records = await getRecords();
  const signer = await getSigner();
  await ensureGas(signer.address);
  let key = meta.profileKey;
  if (!key) key = (await records.getProfile(signer.address))?.entityKey;
  const { entityKey } = await records.saveProfile(signer, { wrapped: meta.wrapped, backupRoot: root, backupAt: at }, key);
  await patchMeta({ profileSynced: true, profileKey: entityKey });
}
