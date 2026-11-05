# One-page plan

**Goal:** a private period tracker where AI is the product (0G PC) and data ownership and expiry are native (Arkiv). Encrypted end to end, mobile-first.

## Architecture

- **Browser:** Next.js client pages. All crypto runs here: libsodium Argon2id + XChaCha20-Poly1305, IndexedDB holding ciphertext only, DK in memory.
- **Adapters** (`lib/adapters`): `StorageAdapter` (0G Storage / mock), `ProfileAdapter` + `SharesAdapter` (Arkiv / mock), `AiAdapter` (0G PC / mock). `NEXT_PUBLIC_MOCK_SERVICES=true` swaps all of them.
- **Server routes:** `/api/ai/chat` and `/api/ai/transcribe` (0G PC proxy with fixed prompts), `/api/storage/upload|download` (0G Storage, ciphertext only), `/api/arkiv-rpc` (keyed RPC proxy, signed transactions pass through), `/api/fund` (tGLM faucet relay), `/api/health`.

## Phases (status)

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold, adapters + mocks, env, DECISIONS, section 9 checks | ✅ (live write checks need funded keys) |
| 1 | `lib/crypto` + tests, signup/unlock, IndexedDB vault, auto-lock, logging, ciphertext verified | ✅ |
| 2 | Calendar, log form, history + charts, predictions | ✅ |
| 3 | Bundle → gzip → seal → upload, Arkiv profile, queue + indicators, restore | ✅ mock e2e · ⚠️ live pending funds |
| 4 | AI proxy, Ask, insights, summary PDF, voice logging, request IDs, timeouts/retry | ✅ mock e2e · ⚠️ live pending API key |
| 5 | Share create, link/QR/WhatsApp, doctor view, revoke, active list, expiry | ✅ mock e2e · ⚠️ live pending funds |
| 6 | Polish: 360 px check, error/empty states, docs | ✅ (real-device throttled test still to do) |

## Remaining to reach "done against real testnets"

1. Fund the relay key on the Arkiv + 0G faucets, then run `scripts/verify-arkiv-write.mts` and `scripts/verify-zerog.mts storage`.
2. Add a thirdweb client ID and test email login plus a signed profile write in the browser.
3. Add a 0G PC key; run `scripts/verify-zerog.mts ai`; confirm the transcription path and model choice.
4. Restore in a clean browser profile against real services; share link in a second browser; DevTools Slow 4G + 6× CPU pass.
