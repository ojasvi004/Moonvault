# 🗄️ Moonvault × Arkiv

> **Prize Track:** [Build on Arkiv](https://ethglobal.com/events/mumbai/prizes/arkiv) — \$4,000 Pool

---

## The Challenge

> *"Mirror something Ethereum depends on."*

Moonvault mirrors **expiring access control** — a primitive Ethereum doesn't have natively. Shared medical records should self-destruct. Arkiv's built-in entity expiration makes this a first-class feature instead of a cron-job afterthought.

---

## Judging Criteria

| Criterion (25% each) | How Moonvault Addresses It |
|----------------------|---------------------------|
| **Feedback** | 6 friction points documented in [`arkiv/friction.md`](../arkiv/friction.md) — typed predicates, filter requirements, access key exposure, smart account gaps, block vs wall-clock expiry, browser-only faucet |
| **Reach** | Targets people who menstruate, especially where reproductive data can be weaponized. Mobile-first (360px, Slow-4G), WhatsApp share links. Every doctor view is organic distribution. See [`arkiv/reach.md`](../arkiv/reach.md) |
| **Why Arkiv** | Native expiry, wallet ownership, queryable attributes, public-by-design forcing encrypt-first, read-without-wallet. See [`arkiv/why-arkiv.md`](../arkiv/why-arkiv.md) |
| **Execution** | Two production schemas, dual-persistence architecture, full CRUD lifecycle, verification scripts, 39/39 tests passing |

---

## Schemas

### `mv.profile` — One per account

Stores the user's wrapped encryption key and backup pointer on-chain.

```typescript
defineSchema("mv.profile", {
  v:          i32(),           // schema version
  wrappedDk:  bytes(),         // Argon2id params + XChaCha20-sealed Data Key
  backupRoot: str().optional(),// 0G Storage Merkle root
  backupAt:   u64().optional(),// backup timestamp
});
```

| Operation | When | Expiry |
|-----------|------|--------|
| Create | First signup | `ExpirationTime.max()` (~182 days) |
| Patch | After backup (update `backupRoot`) | Unchanged |
| Extend | Every login (12h debounce) | Reset to max |

**Privacy:** The `wrappedDk` is doubly encrypted — sealed with the user's passphrase-derived KEK (Argon2id). Even Arkiv validators see only opaque bytes.

### `mv.share` — One per shared link

Time-limited encrypted health data shared with a doctor or partner.

```typescript
defineSchema("mv.share", {
  shareId:     str().indexed(),  // 128-bit random, base64url
  scope:       str().indexed(),  // "full" | "3m" | "6m" | "1y"
  createdAt:   u64(),            // creation timestamp
  expiresAtMs: u64().indexed(),  // millisecond expiry for query filtering
  payload:     bytes().optional(),// sealed ciphertext (≤96KB inline)
  pointer:     str().optional(), // 0G Storage root for large payloads
});
```

| Operation | When | Expiry |
|-----------|------|--------|
| Create | User generates share link | `ExpirationTime.fromSeconds(duration)` — 1h to 90 days |
| Read (doctor) | Doctor opens `/s/<id>#<key>` | No account needed |
| List | Dashboard "Active Links" | Filter: `expiresAtMs > now` |
| Revoke | User taps "Revoke" | `deleteEntity` — immediate |

**Share link anatomy:** `/s/<shareId>#<shareKey>` — the key lives only in the URL fragment (never sent to any server).

---

## Why Arkiv Over Postgres

| Requirement | Postgres | Arkiv |
|-------------|----------|-------|
| **Expiry is the product** | Cron job + `DELETE WHERE expires < NOW()` | Native `ExpirationTime` — records auto-expire at the protocol level |
| **Ownership without our server** | Our DB, our rules | Wallet-signed entities — user owns their data on-chain |
| **Queryable by owner + attribute** | ✅ | ✅ `ownedBy(address).where(gt("expiresAtMs", ...))` |
| **Public-by-design** | Private by default | Forces encrypt-first architecture — if it's on-chain, it must be sealed |
| **Doctor reads without account** | API key or guest token | `select().where(eq("shareId", id))` — no wallet, no signup |

See full rationale in [`arkiv/why-arkiv.md`](../arkiv/why-arkiv.md).

---

## Architecture

```
Browser                          Server Proxy              Arkiv (Rabdi Testnet)
  │                                  │                          │
  │── createEntity(mv.share) ───────►│                          │
  │   (signed by user's EOA)         │── eth_sendRawTransaction►│
  │                                  │◄── tx receipt ──────────│
  │◄── { entityKey, txHash } ───────│                          │
  │                                  │                          │
  │   Doctor opens /s/<id>#<key>     │                          │
  │── select().where(eq(shareId)) ──►│── arkiv_query ──────────►│
  │                                  │◄── entity rows ─────────│
  │◄── sealed payload ──────────────│                          │
  │── decrypt(key, payload) ────────►(local)                    │
```

**Key design decisions:**

1. **RPC proxy** ([`app/api/arkiv-rpc/route.ts`](../app/api/arkiv-rpc/route.ts)) — Keeps the `ARKIV_ACCESS_KEY` server-side. Method allowlist prevents abuse. Rate limited at 600 req/min.

2. **Dual persistence** — Every write goes to both Arkiv (on-chain) and MongoDB (cloud fallback). Reads try Arkiv first. This ensures availability even when testnet is congested or the user's wallet has insufficient gas.

3. **Entity keys** — On-chain entities use Arkiv-assigned keys. Cloud-only fallbacks use prefixed keys (`prof-*`, `share-*`) so the adapter knows which store to query.

---

## Friction Log

Six issues encountered during development (full details in [`arkiv/friction.md`](../arkiv/friction.md)):

| # | Issue | Impact | Workaround |
|---|-------|--------|------------|
| 1 | Typed predicates require `u64(0)` not `0n` | Runtime crash with native BigInt | Wrap all numeric comparisons |
| 2 | Bare `select()` without filter throws in `toString()` | Cannot list all entities | Always add a filter predicate |
| 3 | Access key embedded in URL path | Cannot expose RPC to browser | Built server-side proxy route |
| 4 | Smart accounts (thirdweb) don't work | Need raw EOA for `createEntity` | Use in-app wallet's EOA directly |
| 5 | Block-based expiry ≠ wall-clock time | 2s blocks make precise minute-level expiry approximate | Compute seconds from target, accept ±1 block drift |
| 6 | Browser-only faucet (no API) | Cannot fund test wallets in CI | Manual pre-funding, skip on-chain tests in CI |

---

## Code References

| Component | Path | Purpose |
|-----------|------|---------|
| Adapter | [`lib/adapters/arkiv/adapter.ts`](../lib/adapters/arkiv/adapter.ts) | Full CRUD: profile + shares with dual persistence |
| Schema definitions | [`lib/adapters/arkiv/schema.ts`](../lib/adapters/arkiv/schema.ts) | `mv.profile` and `mv.share` column definitions |
| Client setup | [`lib/adapters/arkiv/client.ts`](../lib/adapters/arkiv/client.ts) | Rabdi chain config, public + wallet clients |
| RPC proxy | [`app/api/arkiv-rpc/route.ts`](../app/api/arkiv-rpc/route.ts) | Method-allowlisted JSON-RPC proxy |
| Share logic | [`lib/share/share.ts`](../lib/share/share.ts) | `createShare`, `readShare`, `revokeShare`, seal/open |
| Profile sync | [`lib/vault/profileSync.ts`](../lib/vault/profileSync.ts) | Background DK sync + backup pointer updates |
| Share API | [`app/api/share/route.ts`](../app/api/share/route.ts) | Cloud share CRUD (MongoDB fallback) |
| Partner API | [`app/api/partner/route.ts`](../app/api/partner/route.ts) | Partner link management |
| Profile API | [`app/api/profile/route.ts`](../app/api/profile/route.ts) | Cloud profile CRUD |

### Supporting Docs

| Document | Path |
|----------|------|
| Schema deep-dive | [`arkiv/schema.md`](../arkiv/schema.md) |
| How we use Arkiv | [`arkiv/how-you-use-arkiv.md`](../arkiv/how-you-use-arkiv.md) |
| Why Arkiv | [`arkiv/why-arkiv.md`](../arkiv/why-arkiv.md) |
| Reach & distribution | [`arkiv/reach.md`](../arkiv/reach.md) |
| Friction log | [`arkiv/friction.md`](../arkiv/friction.md) |

## Verification

```bash
# Read-only: block number, timing, sample entity queries
npx tsx scripts/verify-arkiv-read.mts

# Full lifecycle: create → read → patch → extend → share → revoke
npx tsx scripts/verify-arkiv-write.mts
```

---

## Configuration

| Variable | Purpose |
|----------|---------|
| `ARKIV_ACCESS_KEY` | Rabdi testnet access key (used in RPC URL) |
| `RELAY_PRIVATE_KEY` | EOA signer for server-side entity writes |

**Network:** Rabdi testnet — chain ID `7794095`, SDK `@arkiv-network/sdk@1.0.1`

