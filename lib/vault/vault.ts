import { generateDk, unwrapDk, wrapDk, memzero, type WrappedDk } from "@/lib/crypto";
import { getMeta, putMeta, wipeLocalVault, type VaultMeta } from "./db";
import { bindAutoLock, setDk } from "./session";

/** Create a brand-new vault for this account. The DK only ever leaves memory wrapped. */
export async function createVault(owner: string, passphrase: string): Promise<VaultMeta> {
  const dk = await generateDk();
  try {
    const wrapped = await wrapDk(dk, passphrase);
    const meta: VaultMeta = { id: "vault", owner: owner.toLowerCase(), wrapped, createdAt: Date.now(), profileSynced: false };
    await putMeta(meta);
    setDk(dk.slice());
    bindAutoLock();
    return meta;
  } finally {
    await memzero(dk);
  }
}

/** Unlock the local vault. Throws WrongPassphraseError on a bad passphrase. */
export async function unlockVault(passphrase: string): Promise<VaultMeta> {
  const meta = await getMeta();
  if (!meta) throw new Error("No vault on this device.");
  const dk = await unwrapDk(meta.wrapped, passphrase);
  setDk(dk);
  bindAutoLock();
  return meta;
}

/** Adopt a wrapped DK fetched from the cloud profile (restore on a new device). Replaces local data. */
export async function adoptVault(owner: string, wrapped: WrappedDk, passphrase: string, profileKey: string): Promise<VaultMeta> {
  const dk = await unwrapDk(wrapped, passphrase); // throws WrongPassphraseError
  // Only replace local data once the passphrase is proven correct.
  await wipeLocalVault();
  const meta: VaultMeta = {
    id: "vault",
    owner: owner.toLowerCase(),
    wrapped,
    createdAt: Date.now(),
    profileSynced: true,
    profileKey,
  };
  await putMeta(meta);
  setDk(dk);
  bindAutoLock();
  return meta;
}
