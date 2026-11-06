// Moonvault crypto primitives.
//
// Envelope format for every sealed blob (entries, backups, shares, wrapped DK):
//   [1 byte format version][24 byte random nonce][XChaCha20-Poly1305 ciphertext+tag]
// Associated data = header byte || utf8(context), where context is a domain
// separation string such as "moonvault:entry:v1". A blob sealed for one
// context can never be opened as another.

import { initSodium, type Sodium } from "./sodium";
import { concatBytes, fromBase64Url, fromUtf8, toBase64Url, utf8 } from "./encoding";

export { initSodium, toBase64Url, fromBase64Url };
export type { Sodium };

export const SEAL_VERSION = 1;
export const KEY_BYTES = 32;
export const NONCE_BYTES = 24;

export const CTX = {
  dk: "moonvault:dk:v1",
  entry: "moonvault:entry:v1",
  backup: "moonvault:backup:v1",
  share: "moonvault:share:v1",
  meta: "moonvault:meta:v1",
  partner: "moonvault:partner:v1", // partner package, sealed with the partner key
  partnerWrap: "moonvault:partner-wrap:v1", // partner key, sealed for the partner's account
} as const;
export type CryptoContext = (typeof CTX)[keyof typeof CTX];

export class DecryptionError extends Error {
  constructor(message = "Could not decrypt: wrong key or the data was modified.") {
    super(message);
    this.name = "DecryptionError";
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase did not unlock the vault.");
    this.name = "WrongPassphraseError";
  }
}

export class UnsupportedVersionError extends Error {
  constructor(version: number) {
    super(`Unsupported encrypted data version ${version}.`);
    this.name = "UnsupportedVersionError";
  }
}

// ---------------------------------------------------------------- KDF

export type KdfParams = {
  alg: "argon2id13";
  opslimit: number;
  memlimit: number; // bytes
  salt: string; // base64url, 16 bytes
};

/** Default Argon2id cost: libsodium INTERACTIVE (ops=2, 64 MiB). See DECISIONS.md. */
export async function defaultKdfParams(overrides?: Partial<Omit<KdfParams, "alg" | "salt">>): Promise<KdfParams> {
  const s = await initSodium();
  return {
    alg: "argon2id13",
    opslimit: overrides?.opslimit ?? s.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memlimit: overrides?.memlimit ?? s.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    salt: toBase64Url(s.randombytes_buf(s.crypto_pwhash_SALTBYTES)),
  };
}

/** Argon2id(passphrase, salt) -> 32-byte key-encryption key. Caller must memzero it. */
export async function deriveKek(passphrase: string, params: KdfParams): Promise<Uint8Array> {
  const s = await initSodium();
  if (params.alg !== "argon2id13") throw new Error(`Unsupported KDF ${params.alg}`);
  const salt = fromBase64Url(params.salt);
  if (salt.length !== s.crypto_pwhash_SALTBYTES) throw new Error("Bad salt length");
  const pw = utf8(passphrase.normalize("NFKC"));
  try {
    return s.crypto_pwhash(KEY_BYTES, pw, salt, params.opslimit, params.memlimit, s.crypto_pwhash_ALG_ARGON2ID13);
  } finally {
    s.memzero(pw);
  }
}

// ---------------------------------------------------------------- keys

export async function generateDk(): Promise<Uint8Array> {
  const s = await initSodium();
  return s.randombytes_buf(KEY_BYTES);
}

export async function newShareKey(): Promise<Uint8Array> {
  const s = await initSodium();
  return s.randombytes_buf(KEY_BYTES);
}

export async function memzero(...keys: (Uint8Array | null | undefined)[]): Promise<void> {
  const s = await initSodium();
  for (const k of keys) if (k) s.memzero(k);
}

// ---------------------------------------------------------------- seal / open

function ad(context: string, version: number): Uint8Array {
  return concatBytes(new Uint8Array([version]), utf8(context));
}

/** Encrypt bytes with a fresh random nonce. Output = version || nonce || ciphertext. */
export async function encryptBytes(key: Uint8Array, plain: Uint8Array, context: CryptoContext): Promise<Uint8Array> {
  const s = await initSodium();
  if (key.length !== KEY_BYTES) throw new Error("Bad key length");
  const nonce = s.randombytes_buf(NONCE_BYTES);
  const ct = s.crypto_aead_xchacha20poly1305_ietf_encrypt(plain, ad(context, SEAL_VERSION), null, nonce, key);
  return concatBytes(new Uint8Array([SEAL_VERSION]), nonce, ct);
}

export async function decryptBytes(key: Uint8Array, sealed: Uint8Array, context: CryptoContext): Promise<Uint8Array> {
  const s = await initSodium();
  if (key.length !== KEY_BYTES) throw new Error("Bad key length");
  if (sealed.length < 1 + NONCE_BYTES + s.crypto_aead_xchacha20poly1305_ietf_ABYTES) throw new DecryptionError();
  const version = sealed[0];
  if (version !== SEAL_VERSION) throw new UnsupportedVersionError(version);
  const nonce = sealed.subarray(1, 1 + NONCE_BYTES);
  const ct = sealed.subarray(1 + NONCE_BYTES);
  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, ad(context, version), nonce, key);
  } catch {
    throw new DecryptionError();
  }
}

export async function encryptJson(key: Uint8Array, value: unknown, context: CryptoContext): Promise<Uint8Array> {
  const plain = utf8(JSON.stringify(value));
  try {
    return await encryptBytes(key, plain, context);
  } finally {
    plain.fill(0);
  }
}

export async function decryptJson<T = unknown>(key: Uint8Array, sealed: Uint8Array, context: CryptoContext): Promise<T> {
  const plain = await decryptBytes(key, sealed, context);
  try {
    return JSON.parse(fromUtf8(plain)) as T;
  } finally {
    plain.fill(0);
  }
}

// ---------------------------------------------------------------- DK wrapping

export type WrappedDk = {
  v: 1;
  kdf: KdfParams;
  wrapped: string; // base64url sealed DK (context moonvault:dk:v1)
};

export async function wrapDk(dk: Uint8Array, passphrase: string, kdf?: KdfParams): Promise<WrappedDk> {
  const params = kdf ?? (await defaultKdfParams());
  const kek = await deriveKek(passphrase, params);
  try {
    const sealed = await encryptBytes(kek, dk, CTX.dk);
    return { v: 1, kdf: params, wrapped: toBase64Url(sealed) };
  } finally {
    await memzero(kek);
  }
}

export async function unwrapDk(w: WrappedDk, passphrase: string): Promise<Uint8Array> {
  if (w.v !== 1) throw new UnsupportedVersionError(w.v);
  const kek = await deriveKek(passphrase, w.kdf);
  try {
    return await decryptBytes(kek, fromBase64Url(w.wrapped), CTX.dk);
  } catch (e) {
    if (e instanceof DecryptionError) throw new WrongPassphraseError();
    throw e;
  } finally {
    await memzero(kek);
  }
}
