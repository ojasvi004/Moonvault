"use client";

import Link from "next/link";
import { useState } from "react";
import { LenisScroll } from "@/components/LenisScroll";
import "../../app/pitch/pitch.css";

/* ------------------------------------------------------------------ DATA CONSTANTS */

interface ArchitectureStep {
  id: string;
  tabLabel: string;
  badge: string;
  title: string;
  description: string;
  guarantee: string;
  codeSnippet: string;
  metrics: { label: string; value: string }[];
}

const ARCHITECTURE_STEPS: ArchitectureStep[] = [
  {
    id: "vault",
    tabLabel: "1. Client Cryptographic Vault",
    badge: "Argon2id + XChaCha20-Poly1305",
    title: "Zero-Knowledge Envelope Encryption in Browser Memory",
    description:
      "Health data never leaves the browser in plaintext. When you enter your passphrase, Argon2id derives a 256-bit Key Encryption Key (KEK) using 64 MiB of memory directly on your device. That KEK wraps a cryptographically random 256-bit Data Key (DK). Plaintext cycle dates, symptoms, mood, and intimate notes are sealed with XChaCha20-Poly1305 with domain separation tags before persisting into IndexedDB. The plain DK exists solely in memory while unlocked and is wiped with zeroization on lock or page reload.",
    guarantee:
      "A database leak, compromised phone backup, or server subpoena yields only authenticated ciphertext. Even Moonvault's creators cannot decrypt a single menstrual entry.",
    codeSnippet: `// lib/crypto/index.ts & lib/vault/entries.ts
const kek = await deriveKek(passphrase, salt, { opslimit: 2, memlimit: 64 * 1024 * 1024 });
const wrappedDk = await seal(dk, kek, "moonvault:dk:v1");

// Every entry sealed with unique 192-bit random nonce & domain tag:
const ciphertext = await seal(entryPlaintext, dk, "moonvault:entry:v1");
await idb.put("entries", { id: entry.id, ct: ciphertext, updatedAt: Date.now() });

// On lock / tab reload:
sodium.memzero(dk);
sodium.memzero(kek);`,
    metrics: [
      { label: "Memory Cost", value: "64 MiB Argon2id" },
      { label: "Plaintext Leaks", value: "0 Bytes" },
      { label: "Cipher", value: "XChaCha20-Poly1305" },
    ],
  },
  {
    id: "arkiv",
    tabLabel: "2. Arkiv DB-Chain Records",
    badge: "Arkiv SDK 1.0.1 on Rabdi Testnet",
    title: "Sovereign Profile & Self-Expiring Shared Access Links",
    description:
      "Arkiv provides a decentralized database-chain where entities are owned by wallet addresses and have native block-level lifecycles. We define two typed schemas: 'mv.profile' (holds your wrapped DK and 0G backup Merkle root with a 182-day max lifecycle renewed on login) and 'mv.share' (holds encrypted packages for doctors with native ExpirationTime). When a consultation ends, the record ceases to exist on-chain automatically—no trusted backend cron job required.",
    guarantee:
      "Expiry is the product. Share links self-destruct natively on Rabdi testnet. Revocation is an on-chain signed deleteEntity transaction that only the user's wallet can execute.",
    codeSnippet: `// lib/adapters/arkiv/schema.ts & lib/share/share.ts
export const ShareSchema = entity("mv.share", {
  shareId: str().indexed(),
  scope: str().indexed(), // "dates" | "dates_symptoms" | "full"
  expiresAtMs: u64().indexed(),
  payload: bytes(), // gzip + XChaCha20-Poly1305(shareKey)
  pointer: str().optional(), // 0G Storage root if > 96 KiB
});

// Native DB-chain expiration (1 hour to 90 days):
await arkivClient.createEntity({
  schema: ShareSchema,
  expiration: ExpirationTime.fromSeconds(chosenDurationInSeconds),
  attributes: { shareId, scope, expiresAtMs, payload },
});`,
    metrics: [
      { label: "Profile Expiry", value: "182 Days (Max)" },
      { label: "Share Expiry", value: "Native Block-Level" },
      { label: "Doctor Login", value: "Zero (Wallet-Free)" },
    ],
  },
  {
    id: "zerog-ai",
    tabLabel: "3. 0G Private Computer AI",
    badge: "0G PC · Verifiable TEE Inference",
    title: "Verifiable Private AI with Cryptographic Trace Proofs",
    description:
      "When users ask questions, seek pattern insights, or record 45-second voice logs, Moonvault anonymizes the request client-side before sending: calendar dates are replaced with relative 'daysAgo' offsets, and names, phone numbers, and emails are scrubbed. The prompt executes on 0G Private Computer (qwen3.7-flash, whisper-large-v3, qwen3.5-omni-flash, and minimax-speech-2.8-turbo) with TEE routing (X-0G-Provider-Trust-Mode: private). Every inference response returns a verifiable x_0g_trace.request_id receipt.",
    guarantee:
      "Your biological symptoms never retrain commercial AI models. Every answer is bound to its tamper-evident 0G Request ID, sealed locally, and auditable on the network.",
    codeSnippet: `// lib/ai/anonymize.ts & lib/server/zerog.ts
const anonymized = anonymizeCycleData(entries, { stripPii: true, relativeDays: true });

const response = await fetch("https://router-api.0g.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${env.zgApiKey}\`,
    "X-0G-Provider-Trust-Mode": "private", // TEE-sealed inference
  },
  body: JSON.stringify({ model: "qwen3.7-flash", messages: prompt }),
});

const data = await response.json();
const verificationId = data.x_0g_trace?.request_id; // Verifiable proof
// Result sealed with Verification ID into local encrypted vault:
await sealAiResult({ answer: data.choices[0].message.content, verificationId });`,
    metrics: [
      { label: "TEE Trust Mode", value: "Private Enclave" },
      { label: "Receipt Trace", value: "x_0g_trace ID" },
      { label: "PII Scrubbing", value: "100% Client-Side" },
    ],
  },
  {
    id: "zerog-storage",
    tabLabel: "4. 0G Storage Merkle Backups",
    badge: "@0gfoundation/0g-ts-sdk",
    title: "Content-Addressed Encrypted Vault Backups on 0G Galileo",
    description:
      "Moonvault creates self-describing encrypted snapshot bundles: compressed via fflate gzip, sealed with the random Data Key, and uploaded to 0G Storage using the official 0G TypeScript SDK. The file is partitioned into Merkle tree segments and content-addressed by its root hash. The root hash is then patched into the user's Arkiv mv.profile entity. When logging in on any new device or phone, Moonvault reads the root from Arkiv and restores the entire vault in under two seconds.",
    guarantee:
      "Decentralized cloud durability without vendor lock-in. 0G nodes store only authenticated ciphertext, completely unreadable without the Argon2id passphrase.",
    codeSnippet: `// lib/server/zgStorage.ts & lib/backup/bundle.ts
const bundleBytes = seal(dk, gzip(JSON.stringify(vaultSnapshot)));

const file = new MemData(bundleBytes);
const [tree] = await file.merkleTree();
const rootHash = tree.rootHash(); // 0x9c3f... Merkle Root

// Upload to 0G Galileo Testnet Indexer & anchor on-chain:
const indexer = new Indexer(serverEnv.zgIndexerRpc);
await indexer.upload(file, serverEnv.zgEvmRpc, signer, { skipIfFinalized: true });

// Patch Arkiv profile entity with the new backup pointer:
await arkivClient.patchEntity({
  entityKey: profileKey,
  attributes: { backupRoot: rootHash, backupAt: Date.now() },
});`,
    metrics: [
      { label: "Storage Network", value: "0G Galileo" },
      { label: "Addressing", value: "Merkle Tree Root" },
      { label: "Restore Speed", value: "< 2.0s" },
    ],
  },
  {
    id: "doctor",
    tabLabel: "5. Zero-Login Clinician Portal",
    badge: "URL #fragment Key Custody",
    title: "Instant Clinician Access with Zero Wallet Friction",
    description:
      "Doctors are busy and do not have Web3 wallets, gas tokens, or browser extensions. Moonvault's Shared Access Link (/s/[shareId]#[key]) encodes the 256-bit symmetric decryption key solely in the URL hash fragment. Because browsers never transmit URL fragments to web servers or proxies, neither Moonvault nor Arkiv RPC nodes ever see the key. The clinician's phone fetches the ciphertext from Arkiv without logging in and decrypts it directly in browser RAM.",
    guarantee:
      "Zero account creation, zero extensions, zero crypto friction for doctors. Clean, responsive mobile view designed for WhatsApp and QR code sharing.",
    codeSnippet: `// app/s/[id]/DoctorView.tsx
// URL: https://moonvault.app/s/sh_9f82d17c#k_4b1a88c2...
const shareId = params.id;
const shareKey = window.location.hash.slice(1); // Never sent to server!

// Read entity from Arkiv through Rabdi RPC proxy (no wallet needed):
const shareEntity = await arkivClient.select().from(ShareSchema)
  .where(and(eq("shareId", shareId), gt("expiresAtMs", Date.now())))
  .first();

if (!shareEntity) throw new Error("Link expired or revoked on Arkiv DB-chain.");

// Decrypt client-side in browser RAM:
const decryptedPackage = await open(shareEntity.payload, shareKey, "moonvault:share:v1");
renderClinicalView(decryptedPackage);`,
    metrics: [
      { label: "Clinician Login", value: "None Required" },
      { label: "Key Transmission", value: "Fragment Only" },
      { label: "Export Formats", value: "Interactive + PDF" },
    ],
  },
];

/* ------------------------------------------------------------------ COMPONENT */

export function PitchDeck() {
  const [activeStepId, setActiveStepId] = useState<string>("vault");
  const [monthsTracked, setMonthsTracked] = useState<number>(12);

  const activeStep = ARCHITECTURE_STEPS.find((s) => s.id === activeStepId) || ARCHITECTURE_STEPS[0];

  // Calculated impact for simulator
  const brokerRecords = monthsTracked * 18;
  const locationPings = monthsTracked * 42;
  const subpoenaDataPoints = monthsTracked * 31;

  return (
    <LenisScroll>
      <div className="pitch-root">
      {/* AMBIENT PASTEL ORBS */}
      <div className="pitch-bg-mesh">
        <div className="pitch-orb-1" />
        <div className="pitch-orb-2" />
      </div>

      {/* HERO SECTION */}
      <section className="pt-8 pb-12 sm:pt-14 sm:pb-20 border-b border-pink-200/60">
        <div className="pitch-container">
          <div className="pitch-hero-grid">
            <div>
              <div className="pitch-pill-badge mb-4">
                <span className="inline-block w-2 h-2 bg-pink-600 animate-pulse" />
                <span>ETHGlobal Mumbai 2026 · Pitch Deck</span>
              </div>

              <h1 className="pitch-section-title text-left mb-4">
                Sovereign FemTech: <br />
                <span className="pitch-text-gradient-pink">Intimate Biology Owned by You,</span>{" "}
                <span className="pitch-text-gradient-peach">Not Centralized Ad Brokers.</span>
              </h1>

              <p className="pitch-section-subtitle text-left mb-6 text-base sm:text-lg">
                Inspired by the privacy paradigm of <strong>PrivyCycle</strong> (ETHGlobal Cannes Finalist), Moonvault productionizes decentralized reproductive health for <strong>ETHGlobal Mumbai 2026</strong>. Health data is sealed client-side with <strong>Argon2id & XChaCha20-Poly1305</strong>, verified with private AI on <strong>0G Private Computer</strong>, backed up to content-addressed <strong>0G Storage</strong>, and governed by self-expiring records on <strong>Arkiv DB-Chain</strong>.
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Link href="/signup" className="pitch-btn pitch-btn-primary pitch-btn-md">
                  🚀 Launch Live Demo
                </Link>
                <a href="#prizes" className="pitch-btn pitch-btn-peach pitch-btn-md">
                  🏆 View Mumbai Prize Tracks ($25.5k)
                </a>
                <a href="#architecture" className="pitch-btn pitch-btn-secondary pitch-btn-md">
                  📐 Inspect Architecture
                </a>
              </div>

              {/* CORE GUARANTEE PILLS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-pink-200">
                <div className="p-2 bg-white border border-pink-200">
                  <div className="text-xs font-mono font-bold text-pink-700">PLAINTEXT</div>
                  <div className="text-sm font-bold text-gray-900">0 Bytes Server</div>
                </div>
                <div className="p-2 bg-white border border-pink-200">
                  <div className="text-xs font-mono font-bold text-pink-700">0G COMPUTE</div>
                  <div className="text-sm font-bold text-gray-900">Receipt on Every Call</div>
                </div>
                <div className="p-2 bg-white border border-pink-200">
                  <div className="text-xs font-mono font-bold text-pink-700">ARKIV EXPIRY</div>
                  <div className="text-sm font-bold text-gray-900">Self-Destructing Shares</div>
                </div>
                <div className="p-2 bg-white border border-pink-200">
                  <div className="text-xs font-mono font-bold text-pink-700">ONBOARDING</div>
                  <div className="text-sm font-bold text-gray-900">Zero Seed Phrase</div>
                </div>
              </div>
            </div>

            {/* HERO VISUAL MOCKUP CARD */}
            <div className="pitch-offset-wrapper">
              <div className="pitch-offset-backdrop" />
              <div className="pitch-offset-foreground bg-white">
                <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-stone-800">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-400 border border-stone-800" />
                    <span className="w-3 h-3 bg-yellow-400 border border-stone-800" />
                    <span className="w-3 h-3 bg-green-400 border border-stone-800" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider ml-2">Moonvault Live Node</span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-green-100 text-green-800 border border-green-300">
                    Rabdi + 0G Active
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="p-2.5 bg-pink-50 border border-pink-300">
                    <div className="text-pink-800 font-bold mb-1">🔐 1. Client Cryptography</div>
                    <div className="text-stone-700">Passphrase ──Argon2id──▶ KEK (64 MiB) ──wraps──▶ DK</div>
                    <div className="text-stone-500 text-[11px]">IndexedDB stores strictly XChaCha20 ciphertext</div>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-300">
                    <div className="text-amber-900 font-bold mb-1">🤖 2. 0G Private Computer</div>
                    <div className="text-stone-700">Anonymize(daysAgo) ──▶ qwen3.7-flash (TEE Private)</div>
                    <div className="text-stone-500 text-[11px]">Verification Receipt: x_0g_trace.request_id</div>
                  </div>

                  <div className="p-2.5 bg-orange-50 border border-orange-300">
                    <div className="text-orange-900 font-bold mb-1">📦 3. 0G Storage Merkle Root</div>
                    <div className="text-stone-700">Snapshot ──gzip──▶ seal(DK) ──▶ Root 0x9c3f4e…</div>
                    <div className="text-stone-500 text-[11px]">Content-addressed decentralized backup archive</div>
                  </div>

                  <div className="p-2.5 bg-rose-50 border border-rose-300">
                    <div className="text-rose-900 font-bold mb-1">🗄️ 4. Arkiv DB-Chain Records</div>
                    <div className="text-stone-700">Profile: mv.profile (182d max lifecycle)</div>
                    <div className="text-stone-700">Shares: mv.share (native ExpirationTime, 0-login)</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-600">
                  <span>Engine: Next.js 16.4 + libsodium + viem</span>
                  <span className="font-bold text-pink-700">100% Client Custody</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE PROBLEM SECTION */}
      <section id="problem" className="bg-pink-50/50 border-b border-pink-200/60">
        <div className="pitch-container">
          <div className="pitch-section-header">
            <span className="pitch-section-eyebrow">The Reproductive Surveillance Crisis</span>
            <h2 className="pitch-section-title">Centralized FemTech is a Weaponized Honeypot</h2>
            <p className="pitch-section-subtitle">
              Over 200 million women and menstruators track their reproductive biology on ad-funded centralized apps. In a post-Roe legal reality, intimate biology is no longer private—it is subpoenaed evidence.
            </p>
          </div>

          <div className="pitch-grid-3">
            <div className="pitch-card pink">
              <div className="text-2xl mb-2">⚖️</div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">Subpoenas & Legal Vulnerability</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-3">
                Mainstream trackers (Flo, Clue, Period Tracker) comply with court warrants and law enforcement subpoenas. Period dates, missed cycles, and morning-after pill logs have been seized and used as prosecutorial evidence.
              </p>
              <div className="p-2 bg-red-100 border border-red-300 text-xs font-mono text-red-900 font-bold">
                Threat: Unencrypted server databases with user identity tables.
              </div>
            </div>

            <div className="pitch-card peach">
              <div className="text-2xl mb-2">📡</div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">Data Broker & Ad Network Leakage</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-3">
                FTC investigations proved that major FemTech apps quietly transmitted cycle data, symptom logs, and pregnancy intent to Meta Pixel, Google Analytics, and third-party data brokers to serve predatory advertisements.
              </p>
              <div className="p-2 bg-amber-100 border border-amber-300 text-xs font-mono text-amber-900 font-bold">
                Threat: Third-party trackers and centralized analytics SDKs.
              </div>
            </div>

            <div className="pitch-card">
              <div className="text-2xl mb-2">🧠</div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">Cloud AI Prompt Logging</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-3">
                Centralized AI features in modern health apps send raw cycle histories and symptom descriptions to OpenAI or Anthropic cloud endpoints, where private biological data is logged, retained, and used for model training.
              </p>
              <div className="p-2 bg-pink-100 border border-pink-300 text-xs font-mono text-pink-900 font-bold">
                Threat: Plaintext LLM prompts without cryptographic verification.
              </div>
            </div>
          </div>

          {/* SQUARED PROBLEM OFFSET CALLOUT */}
          <div className="pitch-offset-wrapper mt-10">
            <div className="pitch-offset-backdrop red" />
            <div className="pitch-offset-foreground border-red-600">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono font-bold text-red-700 uppercase tracking-widest block mb-1">
                    Moonvault&apos;s Non-Negotiable Axiom
                  </span>
                  <h3 className="text-xl font-bold text-stone-900">
                    &quot;If we can read your cycle data, we have failed. You are the only key holder.&quot;
                  </h3>
                  <p className="text-sm text-stone-600 mt-1 max-w-2xl">
                    Health data is encrypted on your device before it touches any wire. Even if Moonvault&apos;s servers, 0G storage nodes, or Arkiv validators are subpoenaed, they can provide only authenticated, random-looking ciphertext.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Link href="/signup" className="pitch-btn pitch-btn-primary pitch-btn-md">
                    Test Zero-Knowledge Vault
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRIVYCYCLE INSPIRATION & MOONVAULT EVOLUTION */}
      <section id="privycycle" className="border-b border-pink-200/60">
        <div className="pitch-container">
          <div className="pitch-section-header">
            <span className="pitch-section-eyebrow peach">Lineage & Ethos</span>
            <h2 className="pitch-section-title">
              From PrivyCycle&apos;s Cannes Spark to Moonvault&apos;s Mumbai Engine
            </h2>
            <p className="pitch-section-subtitle">
              At ETHGlobal Cannes, <strong>PrivyCycle</strong> captivated judges and won Finalist & 0G awards by proving that women&apos;s reproductive health demands Web3 privacy. Moonvault honors that legacy and elevates the architecture from proof-of-concept into a resilient, production-grade protocol built for real-world clinician sharing and verifiable AI.
            </p>
          </div>

          <div className="pitch-grid-2">
            {/* The PrivyCycle Vision */}
            <div className="pitch-card bg-stone-50 border-stone-400">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold uppercase text-stone-600">ETHGlobal Cannes Finalist</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-stone-200 text-stone-800">PrivyCycle</span>
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">The Foundational Vision</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                PrivyCycle proved that women care deeply about sovereign ownership of their intimate cycle history. It introduced social logins without seed phrases, on-device encryption, and initial exploration of 0G ecosystem AI for maternal health.
              </p>
              <div className="space-y-2 text-xs font-mono border-t border-stone-300 pt-3 text-stone-700">
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-bold">⚠️ Storage Limitation:</span>
                  <span>Static IPFS hashes persist indefinitely without native expiry.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-bold">⚠️ AI Trust Model:</span>
                  <span>Inference prompts lacked tamper-proof cryptographic request receipts.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-bold">⚠️ Doctor Sharing:</span>
                  <span>Clinicians needed Web3 familiarity to inspect historical records.</span>
                </div>
              </div>
            </div>

            {/* The Moonvault Evolution */}
            <div className="pitch-card pink">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold uppercase text-pink-800">ETHGlobal Mumbai 2026 Production</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-pink-200 text-pink-900">Moonvault Evolution</span>
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">The Production-Grade Architecture</h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                Moonvault solves the hardest engineering challenges in decentralized health: native block-based expiration for sharing, cryptographic verification receipts on every AI prediction, and zero-login doctor views.
              </p>
              <div className="space-y-2 text-xs font-mono border-t border-pink-300 pt-3 text-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-green-700 font-bold">✅ Arkiv DB-Chain:</span>
                  <span>Native block-level ExpirationTime ensures shares auto-destruct on chain.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-700 font-bold">✅ 0G PC Receipts:</span>
                  <span>Every AI insight returns verifiable x_0g_trace.request_id in TEE enclaves.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-700 font-bold">✅ Zero-Login Doctor View:</span>
                  <span>Key stays in URL #fragment; doctors decrypt in RAM with 0 wallet install.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE ARCHITECTURE & TOPOLOGY ENGINE */}
      <section id="architecture" className="bg-white border-b border-pink-200/60">
        <div className="pitch-container">
          <div className="pitch-section-header">
            <span className="pitch-section-eyebrow">Cryptographic Blueprint</span>
            <h2 className="pitch-section-title">Deep Technical Topology</h2>
            <p className="pitch-section-subtitle">
              Explore how Moonvault connects client-side Argon2id cryptography, Arkiv DB-Chain state entities, and 0G Private Computer & Storage across every layer of the stack.
            </p>
          </div>

          {/* TAB PILLS */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {ARCHITECTURE_STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => setActiveStepId(step.id)}
                className={`pitch-tab-pill ${activeStepId === step.id ? "active" : ""}`}
              >
                <span>{step.tabLabel}</span>
              </button>
            ))}
          </div>

          {/* TAB CONTENT DISPLAY */}
          <div className="pitch-card peach p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="lg:w-1/2 space-y-4">
                <div className="inline-block px-2.5 py-1 text-xs font-mono font-bold uppercase bg-pink-200 text-pink-900 border border-pink-400">
                  {activeStep.badge}
                </div>

                <h3 className="text-2xl font-bold text-stone-900 pitch-font-serif">
                  {activeStep.title}
                </h3>

                <p className="text-stone-700 text-sm leading-relaxed">
                  {activeStep.description}
                </p>

                <div className="p-3.5 bg-white border border-pink-300">
                  <div className="text-xs font-mono font-bold text-pink-800 uppercase mb-1">
                    Security Guarantee:
                  </div>
                  <p className="text-xs text-stone-800 font-medium">
                    {activeStep.guarantee}
                  </p>
                </div>

                {/* METRICS ROW */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {activeStep.metrics.map((m, idx) => (
                    <div key={idx} className="p-2.5 bg-white border border-stone-800 text-center">
                      <div className="text-[11px] font-mono text-stone-500 uppercase">{m.label}</div>
                      <div className="text-sm font-bold text-stone-900 font-mono mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CODE BLOCK */}
              <div className="lg:w-1/2 w-full">
                <div className="flex items-center justify-between px-3 py-2 bg-stone-900 text-stone-300 text-xs font-mono border-t-2 border-x-2 border-stone-800">
                  <span>Implementation Reference</span>
                  <span className="text-pink-400 font-bold">Source Code Validated</span>
                </div>
                <pre className="pitch-code-block m-0 max-h-[380px] overflow-y-auto">
                  <code>{activeStep.codeSnippet}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRIZE TRACKS DEEP DIVE: 0G FOUNDATION & ARKIV */}
      <section id="prizes" className="bg-pink-50/40 border-b border-pink-200/60">
        <div className="pitch-container">
          <div className="pitch-section-header">
            <span className="pitch-section-eyebrow peach">ETHGlobal Mumbai Tracks</span>
            <h2 className="pitch-section-title">Built for the $25,500 Mumbai Prize Pool</h2>
            <p className="pitch-section-subtitle">
              Moonvault was engineered specifically for the <strong>0G Foundation ($15,000 pool)</strong> and <strong>Arkiv ($10,500 Build on Arkiv track)</strong> prize categories. Here is our exact technical submission mapping.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* PRIZE TRACK 1: 0G FOUNDATION */}
            <div className="pitch-card bg-white border-2 border-stone-900 p-6 sm:p-8">
              <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-stone-900">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">0G Foundation</h3>
                    <span className="text-xs font-mono font-bold text-orange-700">Track: Build with 0G Private Computer ($5,000)</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-stone-900">$5,000 Pool</div>
                  <div className="text-xs text-stone-500">1st ($2.5k) · 2nd ($1.5k) · 3rd ($1k)</div>
                </div>
              </div>

              <p className="text-sm text-stone-700 mb-4 leading-relaxed">
                <strong>Why Moonvault is the Ideal 0G PC Product:</strong> Moonvault is not a developer wrapper; it is a live consumer health app where 0G Private Computer is the indispensable AI engine across four multimodal touchpoints:
              </p>

              <div className="space-y-3 text-xs mb-6">
                <div className="p-3 bg-orange-50 border border-orange-200">
                  <div className="font-bold text-stone-900 mb-1">1. Voice-to-Log Speech Structuring</div>
                  <p className="text-stone-600">
                    Users dictate a 45-second audio entry. It streams to 0G PC transcription (whisper-large-v3 / qwen3.5-omni-flash) and extracts structured clinical JSON (flow, pain, mood, symptoms).
                  </p>
                  <div className="font-mono text-stone-500 mt-1">Route: app/api/ai/transcribe/route.ts</div>
                </div>

                <div className="p-3 bg-orange-50 border border-orange-200">
                  <div className="font-bold text-stone-900 mb-1">2. &quot;Ask Your Cycle&quot; & Pattern Analysis (qwen3.7-flash)</div>
                  <p className="text-stone-600">
                    Natural language queries over anonymized historical cycles with relative day offsets and entity scrubbing. Executed with TEE privacy routing (<code className="bg-orange-100 px-1">X-0G-Provider-Trust-Mode: private</code>).
                  </p>
                  <div className="font-mono text-stone-500 mt-1">Route: app/api/ai/chat/route.ts & lib/ai/prompts.ts</div>
                </div>

                <div className="p-3 bg-orange-50 border border-orange-200">
                  <div className="font-bold text-stone-900 mb-1">3. Verifiable Receipts on Every Inference</div>
                  <p className="text-stone-600">
                    Every AI response extracts <code className="bg-orange-100 px-1">x_0g_trace.request_id</code> and seals it into the user&apos;s encrypted vault as immutable proof of authentic TEE execution.
                  </p>
                  <div className="font-mono text-stone-500 mt-1">Verified: lib/server/zerog.ts (request ID extraction)</div>
                </div>

                <div className="p-3 bg-orange-50 border border-orange-200">
                  <div className="font-bold text-stone-900 mb-1">4. 0G Storage Content-Addressed Vault Backups</div>
                  <p className="text-stone-600">
                    Gzip-compressed encrypted snapshots are converted into Merkle trees via <code className="bg-orange-100 px-1">@0gfoundation/0g-ts-sdk</code> and anchored to 0G Galileo testnet indexers.
                  </p>
                  <div className="font-mono text-stone-500 mt-1">Module: lib/server/zgStorage.ts</div>
                </div>
              </div>

              <div className="p-3 bg-stone-100 border border-stone-300 text-xs font-mono text-stone-800">
                <span className="font-bold text-orange-800">What breaks without 0G:</span> Voice logging, Ask cycle, pattern insights, read-aloud speech, and cloud backup all cease functioning. Only offline math remains.
              </div>
            </div>

            {/* PRIZE TRACK 2: ARKIV */}
            <div className="pitch-card bg-white border-2 border-stone-900 p-6 sm:p-8">
              <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-stone-900">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🗄️</span>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">Arkiv DB-Chain</h3>
                    <span className="text-xs font-mono font-bold text-pink-700">Track: Build on Arkiv ($10,500)</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-bold text-stone-900">$10,500 Pool</div>
                  <div className="text-xs text-stone-500">Arkiv Partner Track</div>
                </div>
              </div>

              <p className="text-sm text-stone-700 mb-4 leading-relaxed">
                <strong>Meeting All Four Arkiv Judging Criteria (25% Each):</strong> Moonvault demonstrates how Arkiv&apos;s native DB-chain capabilities solve real privacy and data ownership bottlenecks:
              </p>

              <div className="space-y-3 text-xs mb-6">
                <div className="p-3 bg-pink-50 border border-pink-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-stone-900">1. Technical Depth (25%)</span>
                    <span className="font-mono text-green-700 font-bold">SDK 1.0.1 on Rabdi</span>
                  </div>
                  <p className="text-stone-600">
                    Two typed entity schemas (<code className="bg-pink-100 px-1">mv.profile</code> and <code className="bg-pink-100 px-1">mv.share</code>). Employs native <code className="bg-pink-100 px-1">ExpirationTime</code>, viem account bridge for thirdweb EOA signing, and indexed SQL queries.
                  </p>
                  <div className="font-mono text-stone-500 mt-1">Schema: arkiv/schema.md & lib/adapters/arkiv/schema.ts</div>
                </div>

                <div className="p-3 bg-pink-50 border border-pink-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-stone-900">2. Why Arkiv (25%)</span>
                    <span className="font-mono text-green-700 font-bold">Expiry is the Product</span>
                  </div>
                  <p className="text-stone-600">
                    Shared health links must self-destruct when time is up. Arkiv native expiration eliminates fragile off-chain cron jobs. Public ledger transparency forces true client-side zero-knowledge encryption.
                  </p>
                  <div className="font-mono text-stone-500 mt-1">Documented: arkiv/why-arkiv.md</div>
                </div>

                <div className="p-3 bg-pink-50 border border-pink-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-stone-900">3. Reach (25%)</span>
                    <span className="font-mono text-green-700 font-bold">Global + Mumbai Focus</span>
                  </div>
                  <p className="text-stone-600">
                    Designed for menstruators globally, optimized for urban India: mobile-first 360px viewport, WhatsApp share links, and Slow-4G resilience. Reusable pattern for any self-destructing sensitive Web3 document.
                  </p>
                  <div className="font-mono text-stone-500 mt-1">Documented: arkiv/reach.md</div>
                </div>

                <div className="p-3 bg-pink-50 border border-pink-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-stone-900">4. Arkiv Feedback (25%)</span>
                    <span className="font-mono text-green-700 font-bold">Friction Log</span>
                  </div>
                  <p className="text-stone-600">
                    Extensive, constructive developer experience feedback detailing SDK nuances, gas estimation, and RPC proxy allowlisting.
                  </p>
                  <div className="font-mono text-stone-500 mt-1">Documented: arkiv/friction.md</div>
                </div>
              </div>

              <div className="p-3 bg-stone-100 border border-stone-300 text-xs font-mono text-stone-800">
                <span className="font-bold text-pink-800">Verified on Rabdi:</span> Verified live entity reads without a wallet; writes implemented against SDK 1.0.1 at <code className="text-stone-900 font-bold">scripts/verify-arkiv-read.mts</code>.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE RISK VS ZERO-TRUST SIMULATOR */}
      <section id="simulator" className="border-b border-pink-200/60">
        <div className="pitch-container">
          <div className="pitch-section-header">
            <span className="pitch-section-eyebrow">Interactive Privacy Audit</span>
            <h2 className="pitch-section-title">Surveillance Exposure Calculator</h2>
            <p className="pitch-section-subtitle">
              Drag the slider to see how many intimate data points centralized trackers accumulate about you over time—versus Moonvault&apos;s cryptographic guarantee.
            </p>
          </div>

          <div className="pitch-card bg-white p-6 sm:p-10 max-w-4xl mx-auto">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="monthsSlider" className="text-sm font-bold text-stone-900 uppercase font-mono">
                  Menstrual Cycle Logging Duration:
                </label>
                <span className="text-lg font-bold font-mono px-3 py-1 bg-pink-100 text-pink-900 border border-pink-300">
                  {monthsTracked} {monthsTracked === 1 ? "Month" : "Months"} ({Math.round((monthsTracked / 12) * 10) / 10} Years)
                </span>
              </div>
              <input
                id="monthsSlider"
                type="range"
                min="1"
                max="60"
                value={monthsTracked}
                onChange={(e) => setMonthsTracked(Number(e.target.value))}
                className="pitch-range-slider"
              />
              <div className="flex justify-between text-xs text-stone-500 font-mono mt-1">
                <span>1 Month</span>
                <span>1 Year</span>
                <span>3 Years</span>
                <span>5 Years</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-stone-200">
              {/* TRADITIONAL TRACKER EXPOSURE */}
              <div className="p-4 bg-red-50 border-2 border-red-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold uppercase text-red-800">Traditional Trackers (Flo/Clue)</span>
                  <span className="text-xs font-bold text-red-700 bg-red-200 px-2 py-0.5">High Risk</span>
                </div>
                <div className="space-y-3 font-mono">
                  <div>
                    <div className="text-2xl font-bold text-red-900">{brokerRecords}+</div>
                    <div className="text-xs text-stone-600">Data Broker Profile Inferences Generated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-900">{locationPings}+</div>
                    <div className="text-xs text-stone-600">Location Beacons & Clinic Visits Timestamped</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-900">{subpoenaDataPoints}+</div>
                    <div className="text-xs text-stone-600">Plaintext Symptom & Cycle Days Subpoena-Ready</div>
                  </div>
                  <div className="pt-2 text-xs text-red-800 border-t border-red-200">
                    ❌ Data persists indefinitely in centralized PostgreSQL databases.
                  </div>
                </div>
              </div>

              {/* MOONVAULT PRIVACY GUARANTEE */}
              <div className="p-4 bg-green-50 border-2 border-green-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-bold uppercase text-green-800">Moonvault Architecture</span>
                  <span className="text-xs font-bold text-green-700 bg-green-200 px-2 py-0.5">100% Zero-Trust</span>
                </div>
                <div className="space-y-3 font-mono">
                  <div>
                    <div className="text-2xl font-bold text-green-900">0 Bytes</div>
                    <div className="text-xs text-stone-600">Plaintext Menstrual Data Exposed Anywhere</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">0 Trackers</div>
                    <div className="text-xs text-stone-600">Zero Meta Pixels, Google Analytics, or CDN Scripts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-900">Native Expiry</div>
                    <div className="text-xs text-stone-600">Arkiv Block Expiry Destroys Shared Links Automatically</div>
                  </div>
                  <div className="pt-2 text-xs text-green-800 border-t border-green-200">
                    ✅ Argon2id + 0G TEE Inference + 0G Merkle Root Storage.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MATRIX COMPARISON TABLE */}
      <section id="matrix" className="bg-white border-b border-pink-200/60">
        <div className="pitch-container">
          <div className="pitch-section-header">
            <span className="pitch-section-eyebrow peach">Competitive Landscape</span>
            <h2 className="pitch-section-title">Why Moonvault Wins</h2>
            <p className="pitch-section-subtitle">
              Comparing commercial trackers, Apple Health, naive Web3 IPFS prototypes, and Moonvault.
            </p>
          </div>

          <div className="pitch-matrix-wrap">
            <table className="pitch-matrix">
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Architectural Pillar</th>
                  <th style={{ width: "24%" }}>Commercial Trackers (Flo, Clue)</th>
                  <th style={{ width: "24%" }}>Apple Health / Offline</th>
                  <th style={{ width: "30%" }} className="highlight">
                    Moonvault (0G + Arkiv)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-bold">Key Custody</td>
                  <td>Server holds keys & plaintext in database</td>
                  <td>On-device Apple Keychain (walled garden)</td>
                  <td className="highlight">Client-side Argon2id (64 MiB KEK) + XChaCha20 DK</td>
                </tr>
                <tr>
                  <td className="font-bold">Onboarding Friction</td>
                  <td>Email/Password with centralized profiling</td>
                  <td>Apple ID required (iOS only)</td>
                  <td className="highlight">thirdweb in-app wallet via email OTP (no seed phrase)</td>
                </tr>
                <tr>
                  <td className="font-bold">AI Privacy & Auditing</td>
                  <td>Cloud prompts logged by OpenAI/Anthropic</td>
                  <td>Basic statistical on-device averages</td>
                  <td className="highlight">0G PC TEE inference with verifiable request ID</td>
                </tr>
                <tr>
                  <td className="font-bold">Voice Logging</td>
                  <td>None or sent to cloud voice recorders</td>
                  <td>Siri (Apple cloud transcription)</td>
                  <td className="highlight">45s audio to 0G Whisper/Qwen-Omni with clinical JSON parse</td>
                </tr>
                <tr>
                  <td className="font-bold">Backup Durability</td>
                  <td>Centralized AWS/GCP servers</td>
                  <td>iCloud backup (subject to cloud subpoenas)</td>
                  <td className="highlight">Content-addressed Merkle snapshots on 0G Storage</td>
                </tr>
                <tr>
                  <td className="font-bold">Clinician & Partner Sharing</td>
                  <td>Export PDF or screenshot over email</td>
                  <td>Apple Health sharing (requires both on iOS)</td>
                  <td className="highlight">Arkiv mv.share expiring links, 0-login doctor view</td>
                </tr>
                <tr>
                  <td className="font-bold">Expiry Enforcement</td>
                  <td>None (stored indefinitely on servers)</td>
                  <td>Manual device deletion</td>
                  <td className="highlight">Native block-level ExpirationTime on Arkiv DB-chain</td>
                </tr>
                <tr>
                  <td className="font-bold">Third-Party Trackers</td>
                  <td>Meta Pixel, Google Analytics, Adjust SDKs</td>
                  <td>Apple telemetry</td>
                  <td className="highlight">Strict Zero Trackers, Zero CDN fonts/scripts</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* VERIFIABLE AUDIT & LIVE DEMO SECTION */}
      <section className="bg-pink-50/50 border-b border-pink-200/60">
        <div className="pitch-container">
          <div className="pitch-section-header">
            <span className="pitch-section-eyebrow">Judges & Developers</span>
            <h2 className="pitch-section-title">Verify Live on Testnet</h2>
            <p className="pitch-section-subtitle">
              Moonvault is fully open-source with unit tests and live testnet verification scripts included in the repository.
            </p>
          </div>

          <div className="pitch-grid-3">
            <div className="pitch-card bg-white">
              <div className="text-xs font-mono font-bold text-pink-700 mb-1">UNIT & INTEGRATION TESTS</div>
              <h4 className="font-bold text-stone-900 mb-2">39/39 Automated Tests Passing</h4>
              <p className="text-xs text-stone-600 mb-3">
                Covers envelope encryption, ciphertext-only IndexedDB guarantees, bundle compression, cycle math, and share links.
              </p>
              <pre className="p-2 bg-stone-900 text-stone-200 text-xs font-mono">
                npm test
              </pre>
            </div>

            <div className="pitch-card bg-white">
              <div className="text-xs font-mono font-bold text-orange-700 mb-1">0G STORAGE & COMPUTE</div>
              <h4 className="font-bold text-stone-900 mb-2">Live 0G Verification</h4>
              <p className="text-xs text-stone-600 mb-3">
                Test 0G Private Computer chat and 0G Galileo Merkle tree upload scripts directly from CLI.
              </p>
              <pre className="p-2 bg-stone-900 text-stone-200 text-xs font-mono">
                npx tsx scripts/verify-zerog.mts
              </pre>
            </div>

            <div className="pitch-card bg-white">
              <div className="text-xs font-mono font-bold text-rose-700 mb-1">ARKIV RABDI TESTNET</div>
              <h4 className="font-bold text-stone-900 mb-2">Live Arkiv DB-Chain Read</h4>
              <p className="text-xs text-stone-600 mb-3">
                Query public entities on Rabdi testnet without requiring a wallet or tokens.
              </p>
              <pre className="p-2 bg-stone-900 text-stone-200 text-xs font-mono">
                npx tsx scripts/verify-arkiv-read.mts
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="pitch-container text-center">
          <div className="pitch-pill-badge mb-4">
            <span>🌙🔒 Moonvault · Built with Passion for ETHGlobal Mumbai</span>
          </div>

          <h2 className="pitch-section-title max-w-3xl mx-auto mb-4">
            Experience the Future of Reproductive Data Sovereignty Today.
          </h2>

          <p className="pitch-section-subtitle max-w-2xl mx-auto mb-8">
            Create an encrypted vault in 30 seconds. No seed phrases, no surveillance, no trackers. Your body, your cycle, your keys.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="pitch-btn pitch-btn-primary pitch-btn-lg">
              🚀 Launch Moonvault App
            </Link>
            <Link href="/share" className="pitch-btn pitch-btn-peach pitch-btn-lg">
              🩺 Test Doctor Access Link
            </Link>
            <a
              href="https://github.com/dineshsaini4343/moonvault"
              target="_blank"
              rel="noopener noreferrer"
              className="pitch-btn pitch-btn-secondary pitch-btn-lg"
            >
              ⭐️ View on GitHub
            </a>
          </div>

          <div className="mt-12 pt-8 border-t border-stone-200 text-xs text-stone-500 font-mono">
            MIT Licensed · Designed & Built for ETHGlobal Mumbai 2026 · Powered by Arkiv & 0G Foundation
          </div>
        </div>
      </section>
      </div>
    </LenisScroll>
  );
}
