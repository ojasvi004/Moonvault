// Arkiv entity schemas. Documented in /arkiv/schema.md.
// Everything here is PUBLIC: no names, emails or health details. Only random
// IDs, generic scope labels, timestamps and ciphertext.
import { bytes, defineSchema, i32, str, u64 } from "@arkiv-network/sdk/schema";

export const ProfileSchema = defineSchema("mv.profile", {
  v: i32(), // record format version
  wrappedDk: bytes(), // JSON WrappedDk: Argon2id params + salt + sealed DK (ciphertext)
  backupRoot: str().optional(), // 0G Storage root hash of the latest encrypted bundle
  backupAt: u64().optional(), // ms timestamp of that backup
});

export const ShareSchema = defineSchema("mv.share", {
  shareId: str().indexed(), // 128-bit random base64url; lookup key for the doctor view
  scope: str().indexed(), // "dates" | "dates_symptoms" | "full"
  createdAt: u64(),
  expiresAtMs: u64().indexed(), // app-level wall-clock expiry (Arkiv expiry is block-based)
  payload: bytes().optional(), // ciphertext sealed with the per-share key
  pointer: str().optional(), // 0G root hash when the payload does not fit inline
});
