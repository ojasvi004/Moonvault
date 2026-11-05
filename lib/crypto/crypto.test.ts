import { describe, expect, it } from "vitest";
import {
  CTX,
  DecryptionError,
  UnsupportedVersionError,
  WrongPassphraseError,
  decryptBytes,
  decryptJson,
  defaultKdfParams,
  deriveKek,
  encryptBytes,
  encryptJson,
  fromBase64Url,
  generateDk,
  initSodium,
  newShareKey,
  toBase64Url,
  unwrapDk,
  wrapDk,
  NONCE_BYTES,
} from "./index";

// Cheap Argon2id settings so tests stay fast; production uses INTERACTIVE.
const fastKdf = () => defaultKdfParams({ opslimit: 1, memlimit: 8 * 1024 * 1024 });

describe("encoding", () => {
  it("base64url round-trips arbitrary bytes", () => {
    for (const len of [0, 1, 2, 3, 31, 32, 33, 1000]) {
      const b = new Uint8Array(len).map((_, i) => (i * 37 + 11) & 0xff);
      const t = toBase64Url(b);
      expect(t).not.toMatch(/[+/=]/);
      expect(Array.from(fromBase64Url(t))).toEqual(Array.from(b));
    }
  });
  it("rejects non-base64url input", () => {
    expect(() => fromBase64Url("ab+/")).toThrow();
  });
});

describe("kdf", () => {
  it("is deterministic for the same passphrase and salt", async () => {
    const p = await fastKdf();
    const a = await deriveKek("correct horse battery staple", p);
    const b = await deriveKek("correct horse battery staple", p);
    expect(toBase64Url(a)).toBe(toBase64Url(b));
    expect(a.length).toBe(32);
  });
  it("differs with a different salt", async () => {
    const a = await deriveKek("pw-pw-pw-pw-pw", await fastKdf());
    const b = await deriveKek("pw-pw-pw-pw-pw", await fastKdf());
    expect(toBase64Url(a)).not.toBe(toBase64Url(b));
  });
  it("defaults to libsodium INTERACTIVE limits", async () => {
    const s = await initSodium();
    const p = await defaultKdfParams();
    expect(p.opslimit).toBe(s.crypto_pwhash_OPSLIMIT_INTERACTIVE);
    expect(p.memlimit).toBe(s.crypto_pwhash_MEMLIMIT_INTERACTIVE);
    expect(fromBase64Url(p.salt).length).toBe(16);
  });
});

describe("wrap / unwrap DK", () => {
  it("round-trips with the right passphrase", async () => {
    const dk = await generateDk();
    const w = await wrapDk(dk, "a long vault passphrase!", await fastKdf());
    const back = await unwrapDk(w, "a long vault passphrase!");
    expect(toBase64Url(back)).toBe(toBase64Url(dk));
  });
  it("fails cleanly with a wrong passphrase", async () => {
    const dk = await generateDk();
    const w = await wrapDk(dk, "a long vault passphrase!", await fastKdf());
    await expect(unwrapDk(w, "a long vault passphrase?")).rejects.toBeInstanceOf(WrongPassphraseError);
  });
  it("stores KDF params with the wrapped key", async () => {
    const w = await wrapDk(await generateDk(), "unique-passphrase-marker", await fastKdf());
    expect(w.v).toBe(1);
    expect(w.kdf.alg).toBe("argon2id13");
    expect(w.kdf.opslimit).toBe(1);
    expect(JSON.stringify(w)).not.toContain("unique-passphrase-marker");
  });
  it("rejects an unknown wrapper version", async () => {
    const w = await wrapDk(await generateDk(), "x".repeat(20), await fastKdf());
    await expect(unwrapDk({ ...w, v: 2 as 1 }, "x".repeat(20))).rejects.toBeInstanceOf(UnsupportedVersionError);
  });
});

describe("encrypt / decrypt", () => {
  it("round-trips JSON", async () => {
    const k = await generateDk();
    const value = { date: "2026-11-01", flow: "medium", symptoms: ["cramps"], notes: "ünïcødé ✓" };
    const sealed = await encryptJson(k, value, CTX.entry);
    expect(await decryptJson(k, sealed, CTX.entry)).toEqual(value);
  });
  it("does not leak plaintext", async () => {
    const k = await generateDk();
    const sealed = await encryptJson(k, { notes: "SECRET-CRAMPS" }, CTX.entry);
    expect(new TextDecoder().decode(sealed)).not.toContain("SECRET-CRAMPS");
  });
  it("uses a fresh nonce every time", async () => {
    const k = await generateDk();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const sealed = await encryptBytes(k, new Uint8Array([1, 2, 3]), CTX.entry);
      seen.add(toBase64Url(sealed.subarray(1, 1 + NONCE_BYTES)));
    }
    expect(seen.size).toBe(200);
  });
  it("fails on tampered ciphertext", async () => {
    const k = await generateDk();
    const sealed = await encryptJson(k, { a: 1 }, CTX.entry);
    for (const idx of [5, sealed.length - 1, 1 + NONCE_BYTES]) {
      const t = sealed.slice();
      t[idx] ^= 0x01;
      await expect(decryptJson(k, t, CTX.entry)).rejects.toBeInstanceOf(DecryptionError);
    }
  });
  it("fails with the wrong key", async () => {
    const sealed = await encryptJson(await generateDk(), { a: 1 }, CTX.entry);
    await expect(decryptJson(await generateDk(), sealed, CTX.entry)).rejects.toBeInstanceOf(DecryptionError);
  });
  it("enforces domain separation between contexts", async () => {
    const k = await generateDk();
    const sealed = await encryptJson(k, { a: 1 }, CTX.entry);
    await expect(decryptJson(k, sealed, CTX.backup)).rejects.toBeInstanceOf(DecryptionError);
  });
  it("rejects unknown versions and truncated data", async () => {
    const k = await generateDk();
    const sealed = await encryptJson(k, { a: 1 }, CTX.entry);
    const v2 = sealed.slice();
    v2[0] = 2;
    await expect(decryptBytes(k, v2, CTX.entry)).rejects.toBeInstanceOf(UnsupportedVersionError);
    await expect(decryptBytes(k, sealed.subarray(0, 10), CTX.entry)).rejects.toBeInstanceOf(DecryptionError);
  });
  it("share keys are 32 random bytes and distinct", async () => {
    const a = await newShareKey();
    const b = await newShareKey();
    expect(a.length).toBe(32);
    expect(toBase64Url(a)).not.toBe(toBase64Url(b));
    expect(toBase64Url(a).length).toBe(43);
  });
});
