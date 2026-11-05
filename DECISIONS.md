# Decisions & assumptions

Every non-obvious choice, with the reason. Verification results from section 9 are at the bottom (dated 2026-11-06).

## Stack & platform

| # | Decision | Why |
|---|---|---|
| D1 | **Next.js 16.4 (App Router, Turbopack) + React 19 + Tailwind 4**, as scaffolded by `create-next-app@latest`. Kept `cacheComponents` + `partialPrefetching` (Next 16 defaults). | Current defaults; dynamic route params are wrapped in `<Suspense>` as Cache Components requires. |
| D2 | **Mumbai region via `vercel.json` `regions: ["bom1"]`**, not `preferredRegion`. | `preferredRegion` is deprecated in Next 16 (see `node_modules/next/dist/docs`). |
| D3 | **System fonts only** (serif display stack + system-ui). No `next/font/google`. | Rule: no CDN fonts; system fonts load instantly on budget phones. |
| D4 | **`libsodium-wrappers-sumo`**. | The standard build lacks `crypto_pwhash` (Argon2id). Loaded with dynamic `import()` so it stays out of the first-load JS. |
| D5 | **`fflate` gzip** for bundles and share packages. | Synchronous, tiny, identical in Node (tests) and browsers; `CompressionStream` is not in every target browser. |
| D6 | thirdweb is imported from **`thirdweb/wallets/in-app` only**, and optional `@x402/*` peer deps are aliased to an empty stub in `next.config.ts`. | `thirdweb/wallets` pulls every wallet type, including Coinbase's SDK, whose optional x402 peers aren't installed, so the build fails. We never use x402. |
| D7 | `@types/node@22` pinned. | Vitest 5 requires `@types/node >= 22` as a peer. |

## Crypto

| # | Decision | Why |
|---|---|---|
| C1 | **Envelope = `version(1) ‖ nonce(24) ‖ XChaCha20-Poly1305 ciphertext`**; AD = `version ‖ context`. Contexts: `moonvault:dk:v1`, `:entry:v1`, `:backup:v1`, `:share:v1`, `:meta:v1` (AI results + local share records). | Fresh random nonce per seal (192-bit, so collisions are negligible). The version byte is authenticated, and contexts give domain separation. |
| C2 | **Argon2id default = libsodium INTERACTIVE (ops=2, mem=64 MiB)**, stored with the wrapped key `{alg, opslimit, memlimit, salt}`. | Node: ~180 ms. WASM is ~2–3× slower and a mid-range Android ~2× slower again, so roughly 0.7–1.2 s, inside the 0.5–1.5 s target. 64 MiB is safe on low-end phones; MODERATE (256 MiB) is not. Parameters are per-vault, so they can be raised later without breaking old vaults. |
| C3 | Passphrase normalised with **NFKC** before hashing. | The same passphrase typed on different keyboards/OSes must derive the same key. |
| C4 | Wrong passphrase → `WrongPassphraseError` (AEAD auth failure on the wrapped DK). Tampered data → `DecryptionError`. Unknown version → `UnsupportedVersionError`. | Clean, testable failure modes; never garbage output. |
| C5 | `memzero` on KEK, passphrase bytes, share keys and the DK on lock / replace. Plaintext JSON buffers are zero-filled after sealing. | Hard rule 7. (JS strings such as the passphrase input cannot be wiped; we drop references.) |
| C6 | **DK never derived from a wallet signature**; the passphrase is independent of the login. | Hard rule 8. Losing email access doesn't expose data, and the account provider can't decrypt. |
| C7 | Share packages also embed `shareId` inside the ciphertext and are checked after decryption. | Binds a package to its link, so a ciphertext can't be replayed under another ID. |

## Data & storage

| # | Decision | Why |
|---|---|---|
| S1 | IndexedDB rows are `{id, ct, updatedAt, backedUp}` only. **The date is inside the ciphertext, not an index.** | Period dates are health data. The e2e test asserts no plaintext (notes, symptoms, dates) appears in IndexedDB. |
| S2 | One entry per calendar day (saving a day replaces it). | Matches how people track; keeps cycle math simple. |
| S3 | A decrypted cache lives in memory only while unlocked and is cleared on lock or key change. **A full page reload locks the vault** (the DK is memory-only). | Hard rule 2. Navigating inside the app is client-side, so it doesn't relock; the unlock redirect preserves the full path and query. |
| S4 | Auto-lock after 5 min inactivity (configurable), and on return if the tab was hidden longer than that. | "Auto-lock" feature. |
| S5 | Deletes are tombstones until the next successful backup. | The backup queue must notice deletions. |

## Backup (0G Storage)

| # | Decision | Why |
|---|---|---|
| B1 | Bundle = `"MVB"\x01 ‖ seal(DK, gzip(JSON))`; the JSON has `{format, v, createdAt, manifest:{kind:"full", schema, segments:[{id, kind, base?, counts}]}, data}`. Compress first, then encrypt. | Versioned and self-describing. Future incremental backups can append `kind:"delta"` segments that reference a `base` root. |
| B2 | **v1 uploads a full snapshot each time.** Incremental is a stretch goal and not built. | Bundles are a few KB (a year of entries gzips to about 10–20 KB), so full snapshots are cheap. |
| B3 | **Uploads/downloads go through `/api/storage/*` with a server-held relay key.** | The 0G TS SDK's browser build needs Node polyfills (crypto/buffer/stream) and an ethers signer funded with 0G testnet tokens. A thirdweb in-app account has neither. The server only ever sees ciphertext, and the upload route rejects anything not shaped like a Moonvault envelope. |
| B4 | Auto-backup triggers: ≥3 pending changes, on unlock/start if anything is pending, on `online`, and a 60 s retry after failure. Uploads use 4 attempts with exponential backoff and jitter. | The UI never waits on the network (rule 5.3.3). |
| B5 | After an upload, the profile record is patched with `backupRoot` + `backupAt`. | Restore needs only the account → profile → root. |
| B6 | Resumable/chunked upload is **not** implemented. | Bundles are far below one 0G segment; the SDK's upload retries cover our case. |

## Records (Arkiv)

See `arkiv/schema.md` for fields.

| # | Decision | Why |
|---|---|---|
| A1 | Two schemas: **`mv.profile`** (wrapped DK, backup pointer) and **`mv.share`** (shareId, scope, expiry, ciphertext). The generic prefix `mv` is used instead of the app name. | Records are public; avoid labelling an address as "uses a period tracker" more than necessary. Residual risk: anyone can see that an address owns `mv.*` records. |
| A2 | Profile expiry = **`ExpirationTime.max()`** (7,884,000 blocks × 2 s ≈ 182 days) and **extended to max again on login** (at most every 12 h). | Longest the chain allows (SDK 1.0.1 `MAX_LIFETIME`). Keeps the record alive well past the demo window. |
| A3 | Share expiry = exactly the chosen duration (in seconds) plus an indexed `expiresAtMs`. Queries filter `expiresAtMs > now`. | Arkiv expiry is block-based (~2 s/block), so the app-level wall-clock check catches the gap between expiry and the next block. |
| A4 | Revoke = `deleteEntity` signed by the owner. | One tap; the record is gone immediately. |
| A5 | Inline payload limit is **96 KiB** (SDK bytes budget is 128 KiB per entity, minus ABI/RPC overhead). Larger packages go to 0G Storage with a `pointer`. | See README: with the pointer fallback, expiry is enforced by the app, not cryptography (the ciphertext blob outlives the record). 6 months of "Everything" is about 5–10 KB, so the fallback is rarely used. |
| A6 | **All Arkiv RPC goes through `/api/arkiv-rpc`** (method allowlist: reads + `eth_sendRawTransaction` + `arkiv_*`). Transactions are signed in the browser. | Keeps the Arkiv access key server-side (skill guidance) while the user's own account signs. The doctor view reads through the same proxy without any account. |
| A7 | Writes use the plain **EOA** in-app account bridged to a viem `LocalAccount` (`toAccount` → thirdweb `account.signTransaction`). | The Arkiv SDK drives viem's `writeContract`; native entity ops at `0x…44` require the account itself to send the transaction (no account-abstraction support), so smart accounts / EIP-7702 don't fit. |
| A8 | **No thirdweb gas sponsorship; `/api/fund` relay instead.** It sends `FUND_AMOUNT` (0.002 tGLM) only when the balance is below `FUND_MIN_BALANCE`, with limits of 10/h per IP and 3/day per address, and waits for the receipt. | Sponsorship requires ERC-4337/7702 routing, which conflicts with A7. tGLM is free from the faucet. |

## AI (0G Private Computer)

| # | Decision | Why |
|---|---|---|
| G1 | Base URL `https://router-api.0g.ai/v1`, `Authorization: Bearer sk-…`, **request ID = `x_0g_trace.request_id`** in the response body (fallbacks: `x-request-id` header, `id`). | From the router docs (quickstart, chat-completions). |
| G2 | Chat model default **`qwen3.7-flash`** (env `ZG_CHAT_MODEL`). | Cheapest fast non-thinking model on `/v1/models` with structured-output support. Thinking-only models are slower and risk the 30 s budget. |
| G3 | **Whisper is not on the router's public model list** (checked `/v1/models`, 79 models). The router documents `POST /v1/audio/transcriptions`, so we try `openai/whisper-large-v3` first and, on 400/404/503, fall back to **`qwen3.5-omni-flash`** (audio input via `input_audio`). | Both paths are **unverified without an API key** (see V4). |
| G4 | No `response_format` is sent; strict JSON is enforced by the prompt plus `parseStructured()` validation (enum whitelist, ranges, unknown keys dropped). | `supported_parameters` for the chosen model doesn't list `response_format`; sending it could cause a 400. |
| G5 | **The server builds the prompts** (`lib/ai/prompts.ts`). The client sends `{task, input}` with task ∈ {ask, insights, summary, structure}. | The proxy can't be abused as a generic LLM relay, and the safety prompt can't be stripped by a client. |
| G6 | Anonymisation: dates become `daysAgo` offsets, IDs and timestamps are dropped, notes are scrubbed (emails, phones, URLs, @handles, long numbers, "Dr./Mr. Name"), and only a relevant window is sent (Ask: 14–365 days by question wording; Insights: 200 days; Summary: 183 days). | Rule 1: minimal, anonymised excerpt. |
| G7 | 28 s server timeout, 30 s client timeout, retry button, spinner. Rate limit 30 AI calls per 10 min per IP. Optional `ZG_TRUST_MODE=private` header for TEE-only routing. | Never freeze the UI; protect the paid key. |
| G8 | Every AI result `{answer, requestIds, model}` is sealed into the local `ai` store and included in backups. | "Store it with the result in the local encrypted store." |

## Sharing

| # | Decision | Why |
|---|---|---|
| H1 | Link `/s/<shareId>#<key>`, both base64url (shareId 128-bit random, key 256-bit). `Referrer-Policy: no-referrer` site-wide. | The fragment never reaches a server; no-referrer avoids leaking even the shareId to outbound links. |
| H2 | Scopes: `dates` (bleeding days + flow), `dates_symptoms` (+ symptoms), `full` (+ mood, sleep, notes). Time span 3/6/12 months. Durations 24 h / 7 d / custom 1 h–90 d. | Spec + sensible bounds. |
| H3 | The recipient label is stored only locally (encrypted). The share list comes from **Arkiv queried by owner** and is merged with local labels. | Rule 3 (no names on chain) + "at least one user-visible feature reads from Arkiv". |

## Auth & mock mode

| # | Decision | Why |
|---|---|---|
| M1 | Custom email/code UI (`preAuthenticate` + `wallet.connect({strategy:"email"})`); session restore via `autoConnect`. No `ThirdwebProvider` and no connect modal. | Lazy-loads thirdweb only when needed, and keeps the UI free of jargon. |
| M2 | **Mock auth** when `NEXT_PUBLIC_MOCK_SERVICES=true` *or* no thirdweb client ID: code `123456`, and a deterministic test account per email (SHA-256 of the email, so "restore on a new device" works in mock mode). | Demo resilience. Clearly labelled in the UI ("Demo mode"). Never used with real services. |
| M3 | Mock adapters keep real expiry/ownership semantics and persist to `localStorage`, so a share link works in another tab of the same browser. Mock mode is **single-browser**. | The spec asks for in-memory mocks; persistence was added so the doctor-view demo works. |
| M4 | If a real service is not configured, its API route returns 503 with a clear message. **No silent fake results.** Mock AI output is prefixed `[Demo]`, and its IDs read `mock-…` with a "(demo)" label. | Rule: "Never fake a result silently." |

## UI

| # | Decision | Why |
|---|---|---|
| U1 | "Midnight Warm": deep plum background, ivory text, amber accent, rose = period, lavender = fertile, gold = ovulation. Serif display headings. The doctor view is a light, printable "paper" page. | Spec aesthetic; the report must print well. |
| U2 | Jargon mapping: account record → "Account"; DK backup → "Restore key"; 0G Storage → "Encrypted Cloud Backup"; request ID / root → "Verification ID"; Arkiv share → "Shared Access Link". `errMsg()` replaces raw SDK errors that mention technical terms. | Zero-jargon rule. |
| U3 | Charts are single-series (cycle length, symptom frequency, sleep), so there's no legend; they have hover tooltips, an "All entries" table as the accessible view, and lazy-loaded Recharts. | Dataviz guidance. Mark colours pass 3:1 contrast against the card surface. |
| U4 | Service worker caches only `/_next/static/*` and icons. | Speed, without accidentally caching anything personal. |

## Section 9 verification log (2026-11-06)

| ID | Integration | Result |
|---|---|---|
| V1 | **Arkiv read without a wallet** (`scripts/verify-arkiv-read.mts`) | ✅ Rabdi head block 262198, `blockDuration: 2`, query returned entities using the keyless endpoint. `$expiresAt` filters need `u64(...)`. |
| V2 | **Arkiv write path** (`scripts/verify-arkiv-write.mts`) | ⚠️ Code path reaches gas estimation and fails only with *"total cost … exceeds the balance"*: the relay key `0x3A1a…e6A9` is unfunded. Needs faucet tGLM to finish (create / query by owner / patch / extend / delete / 64–96 KiB payload probe). |
| V3 | **0G Storage** (`scripts/verify-zerog.mts storage`) | ⚠️ SDK 1.2.8 loads in Node, `MemData` merkle root works, upload starts and stops at fee payment (balance 0). Needs 0G Galileo faucet funds. Browser build needs polyfills (README of SDK), hence B3. |
| V4 | **0G Private Computer** | ✅ Docs: base URL, auth, `x_0g_trace.request_id`, `/audio/transcriptions`. ✅ `/v1/models` is public (79 models, no Whisper listed). ⚠️ Live inference not run: needs an `sk-` key, which needs a 0G token deposit (not free unless using pc.0g.ai's free-credit offer). |
| V5 | **thirdweb** | ⚠️ Not run: needs a free client ID. Custom chains are supported via `defineChain({id, rpc})`; in-app wallets expose `signTransaction` (EOA mode). Sponsorship rejected by design (A8). |
| V6 | **Argon2id** | ✅ INTERACTIVE = 181 ms (Node, desktop); 64 MiB/ops 3 = 191 ms; 32 MiB/ops 2 = 61 ms. Unlock in a headless browser e2e run: ~0.3 s. A throttled-CPU phone test (DevTools 6× slowdown) is still to do on a real device. |
| V7 | **End-to-end (mock services)** | ✅ Headless Chrome at 360 px: signup → 10 logs → IndexedDB has 10 rows with fields `id,ct,updatedAt,backedUp` and **no plaintext** → backup → Ask/Insights/Summary each show a Verification ID → PDF download → share link + QR → doctor view in a second tab (dates+symptoms scope hides notes) → tampered key shows an error → revoke → "This link has expired" → remove from device → restore (wrong passphrase gives a clear error; right one restores 10 entries) → lock/unlock. No console errors, no horizontal overflow on any page. |
