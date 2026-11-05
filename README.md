# Moonvault 🌙🔒

**A private, AI-assisted period tracker.** Health data is encrypted in the browser before it goes anywhere. AI runs on **0G Private Computer**. Encrypted backups live on **0G Storage**. Account records and self-expiring share links live on **Arkiv**.

Built for ETHGlobal Mumbai 2026 · Prizes: *0G: Build with 0G PC* · *Arkiv: Build on Arkiv*.

> No analytics, no trackers, no CDN fonts/scripts. Everything used is free (testnets, faucets, free tiers), except 0G PC inference, which needs a small 0G deposit or pc.0g.ai free credits.

## What it does

| Feature | Where |
|---|---|
| Email-code login (thirdweb in-app account), vault passphrase (≥12 chars, zxcvbn ≥3), auto-lock | `/signup`, `/unlock` |
| Daily log: flow, symptoms, mood, sleep, notes; **voice logging** (45 s → transcript → structured fields → you confirm) | `/log` |
| Calendar: period days, predicted next period, fertile window, ovulation estimate, confidence note | `/calendar` |
| History with charts (cycle length, symptoms, sleep) and a table of all entries | `/history` |
| **Ask your cycle**, **pattern insights**, **doctor summary PDF**: every result shows its **Verification ID** (0G request ID) | `/ask` |
| Encrypted Cloud Backup (auto, with pending/last-backed-up indicators) and one-step restore | `/settings`, `/restore` |
| Shared Access Links: scope + duration, link + QR + WhatsApp, active list with countdown, one-tap revoke, **no-login doctor view** | `/share`, `/s/[id]` |

## How privacy works

```
passphrase ──Argon2id──▶ KEK ──wraps──▶ DK (random 32 B, memory only while unlocked)
                                         │
     entries / AI results ──XChaCha20-Poly1305──▶ IndexedDB (ciphertext only)
     full snapshot ──gzip──▶ seal(DK) ──▶ 0G Storage ──root──▶ Arkiv mv.profile
     share package ──gzip──▶ seal(share key) ──▶ Arkiv mv.share (expires) ; key only in URL #fragment
     AI request ──decrypt locally, anonymise (relative days, scrub names/emails/phones)──▶ /api/ai ──▶ 0G PC
```

- The passphrase, KEK and plain DK are never written anywhere. A page reload locks the vault.
- Arkiv records hold only the wrapped key, a backup pointer, random IDs, generic scope labels, timestamps and ciphertext. See [`arkiv/schema.md`](arkiv/schema.md).
- Secrets (0G API key, Arkiv access key, relay key) are server-side only. The browser talks to `/api/*`.

**What breaks if 0G is removed:** voice logging (transcription and structuring), Ask your cycle, pattern insights and the doctor summary all stop working, and encrypted cloud backup and restore stop too. Only on-device tracking and math remain.

## Run it

```bash
npm install
cp .env.example .env.local

# Demo with mock services (no keys needed; single browser; login code 123456):
echo "NEXT_PUBLIC_MOCK_SERVICES=true" > .env.local
npm run dev            # http://localhost:3000

npm test               # Vitest: crypto, vault (ciphertext-only), bundle, share, cycle math
npm run lint && npm run build
```

### Real services (all free except 0G PC credits)

| Variable | Get it |
|---|---|
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | thirdweb dashboard (free). Enable **Email** for in-app wallets and add your domain. |
| `ARKIV_ACCESS_KEY` | https://hub.arkiv.network/access-keys (free; optional, otherwise the rate-limited public endpoint is used) |
| `RELAY_PRIVATE_KEY` | Any new key. Fund it at https://hub.arkiv.network/faucet (tGLM) **and** https://faucet.0g.ai (0G Galileo). Pays for `/api/fund` top-ups and 0G Storage uploads. |
| `ZG_API_KEY` | https://pc.0g.ai → Dashboard → API Keys (`sk-…`). Needs a 0G deposit or free credits. |

Check configuration at `GET /api/health` (booleans only). Verify each integration:

```bash
npx tsx --env-file=.env.local scripts/verify-arkiv-read.mts
npx tsx --env-file=.env.local scripts/verify-arkiv-write.mts
npx tsx --env-file=.env.local scripts/verify-zerog.mts ai
npx tsx --env-file=.env.local scripts/verify-zerog.mts storage
```

Deploy: Vercel. `vercel.json` pins functions to `bom1` (Mumbai). Set the same env vars in the project.

## Integration status (honest)

| Integration | Status |
|---|---|
| Crypto, vault, cycle math, bundle, share packages | ✅ Unit tested (29 tests) and e2e tested in headless Chrome |
| Full app on **mock** adapters | ✅ End-to-end: signup → log → backup → AI → share → doctor view → revoke → restore |
| Arkiv reads (no wallet) | ✅ Verified live on Rabdi |
| Arkiv writes (profile, shares, extend, delete) | ⚠️ Implemented against SDK 1.0.1; live run blocked only on faucet funds (gas estimation reached) |
| 0G Storage upload/download | ⚠️ Implemented (server route, Node SDK); live run blocked only on faucet funds |
| 0G PC chat + request ID | ⚠️ Implemented from the router docs; needs an `sk-` key to run live |
| 0G PC transcription | ⚠️ Whisper is not on the public model list; tries `/audio/transcriptions` then falls back to `qwen3.5-omni-flash` audio input. Unverified. |
| thirdweb email login + signing record writes | ⚠️ Implemented (in-app EOA → viem account bridge); needs a client ID to run live |

When a real service isn't configured, its route returns a clear 503. Results are never faked silently; mock mode is labelled "Demo mode" and mock AI answers are tagged `[Demo]`.

### Notes

- **Share fallback:** packages over 96 KiB go to 0G Storage and only a pointer goes on Arkiv. In that case **expiry is enforced by the app (the record disappears), not by cryptography**: the ciphertext blob remains on 0G, though it is unreadable without the link key.
- **Incremental backups** are not implemented. The bundle manifest already supports `delta` segments.
- **Voice audio** goes to 0G PC for transcription (it is health data, sent only for that request and never stored by us).

## Docs

- [`DECISIONS.md`](DECISIONS.md): every non-obvious decision plus the section 9 verification log
- [`docs/PLAN.md`](docs/PLAN.md): one-page plan
- [`arkiv/`](arkiv): schema, how we use Arkiv, why Arkiv, reach, friction log

MIT licensed.
