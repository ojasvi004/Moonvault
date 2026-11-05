# Why Arkiv

- **Expiry is the product.** A shared health record should stop existing when the patient says so. Arkiv entities have a native expiration, so a 24-hour link is enforced by the database, not by a cron job we would have to run and be trusted to run.
- **Ownership without our server.** The user's account owns their profile and share records. We can't edit, extend or revoke them; only the user can. Revocation is a signed delete.
- **Queryable by owner and attribute.** "Show my active links" and "find the profile for this account" are single indexed queries, with no indexer of our own to host.
- **Public by design, so we encrypt first.** Arkiv's transparency forces the right architecture: only ciphertext and generic labels ever go there.
- **Read without a wallet.** A doctor opens the link on any phone, with no account, extension or tokens.
