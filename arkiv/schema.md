# Arkiv schema

Network: **Rabdi testnet** (chain `7794095`), SDK `@arkiv-network/sdk@1.0.1`. Source: `lib/adapters/arkiv/schema.ts`.

Everything in an Arkiv record is public. These records hold **no names, no emails and no health details**. They contain only random IDs, a generic scope label, timestamps and ciphertext.

## `mv.profile` — one per account

| Column | Type | Indexed | Content |
|---|---|---|---|
| `arkiv.schema` | str | ✅ (automatic) | `"mv.profile"` |
| `v` | i32 | – | record format version (`1`) |
| `wrappedDk` | bytes | – | JSON `{v, kdf:{alg:"argon2id13", opslimit, memlimit, salt}, wrapped}`: the vault key sealed with Argon2id(passphrase). Useless without the passphrase. |
| `backupRoot` | str? | – | 0G Storage root of the latest encrypted bundle |
| `backupAt` | u64? | – | ms timestamp of that backup |

- **Owner:** the user's account (thirdweb in-app EOA). Only the owner can patch, extend or delete it.
- **Query:** `select(...).from(ProfileSchema).ownedBy(address)` (filter on `$owner` plus the schema tag).
- **Expiry:** `ExpirationTime.max()` (7,884,000 blocks ≈ 182 days) at create. **Extended to max again on login** (at most every 12 h).
- **Writes:** create at signup (background), `patchEntity` after each backup, `extendEntity` on login.

## `mv.share` — one per Shared Access Link

| Column | Type | Indexed | Content |
|---|---|---|---|
| `arkiv.schema` | str | ✅ | `"mv.share"` |
| `shareId` | str | ✅ | 128-bit random, base64url. Appears in the link path `/s/<shareId>` |
| `scope` | str | ✅ | `dates` \| `dates_symptoms` \| `full` (generic label, no data) |
| `createdAt` | u64 | – | ms |
| `expiresAtMs` | u64 | ✅ | wall-clock expiry in ms (app-level check) |
| `payload` | bytes? | – | gzip+XChaCha20-Poly1305 package sealed with a per-share key that exists only in the link's `#fragment` |
| `pointer` | str? | – | 0G Storage root when the package is larger than 96 KiB |

- **Owner:** the sharer's account.
- **Queries:**
  - Doctor view: `.from(ShareSchema).where(and(eq("shareId", id), gt("expiresAtMs", u64(now))))`. No account needed.
  - Active list: `.from(ShareSchema).ownedBy(address).where(gt("expiresAtMs", u64(now)))`.
- **Expiry:** `ExpirationTime.fromSeconds(chosen duration)`. 24 h, 7 d or custom (1 h–90 d). The record disappears from the chain state on its own.
- **Revoke:** `deleteEntity(entityKey)`, signed by the owner.

## What an observer can learn

That an address owns `mv.profile` / `mv.share` records, when shares were created and when they expire, and the generic scope. They cannot learn any dates, symptoms, notes or recipient names.
