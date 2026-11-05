// Lazy libsodium loader. The sumo build is used because the standard build
// of libsodium-wrappers does not include crypto_pwhash (Argon2id).
import type _sodium from "libsodium-wrappers-sumo";

export type Sodium = typeof _sodium;

let sodiumPromise: Promise<Sodium> | null = null;

/** Load and initialise libsodium once. Safe to call many times. */
export function initSodium(): Promise<Sodium> {
  if (!sodiumPromise) {
    sodiumPromise = import("libsodium-wrappers-sumo").then(async (mod) => {
      const s = (mod.default ?? mod) as Sodium;
      await s.ready;
      return s;
    });
  }
  return sodiumPromise;
}
