# How Moonvault uses Arkiv

1. **Profile record (restore on any device).** At signup the browser wraps the vault key with Argon2id(passphrase) and writes it to an `mv.profile` entity owned by the user's account. After each encrypted backup, the record is patched with the 0G Storage root. On a new device: sign in, then **read the profile by owner**, unwrap with the passphrase, and download and decrypt the bundle. Restore is a user-visible Arkiv read.
2. **Shared Access Links (expiring sharing).** Sharing creates an `mv.share` entity whose payload is ciphertext and whose **Arkiv expiration equals the chosen duration**. The doctor view (`/s/[id]`) reads the entity **without any account** and decrypts with the key from the URL fragment. Once the entity expires or is deleted, the link shows "This link has expired".
3. **Active links list.** The Share page queries Arkiv for `mv.share` entities **owned by the user**, with a live countdown from the expiry, and offers one-tap revoke (`deleteEntity`).

Code: `lib/adapters/arkiv/*`, `lib/vault/profileSync.ts`, `lib/share/share.ts`, `lib/backup/restore.ts`, proxy at `app/api/arkiv-rpc`.
