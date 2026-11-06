"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { MoonMark } from "@/components/ui";
import AnimatedGradient, { PEACH_PASTEL } from "@/components/fancy/AnimatedGradientSvg";
import NumberTicker from "@/components/fancy/BasicNumberTicker";
import CenterUnderline from "@/components/fancy/CenterUnderline";
import ScrambleHover from "@/components/fancy/ScrambleHover";
import ScrambleIn from "@/components/fancy/ScrambleIn";
import ScrollAndSwapText from "@/components/fancy/ScrollAndSwapText";
import SimpleMarquee from "@/components/fancy/SimpleMarquee";
import StackingCards, { StackingCardItem } from "@/components/fancy/StackingCards";
import StickyFooter from "@/components/fancy/StickyFooter";
import TextAlongPath from "@/components/fancy/TextAlongPath";
import TextHighlighter from "@/components/fancy/TextHighlighter";
import TextRotate from "@/components/fancy/TextRotate";

const PEACH = "#f2a65a4d";
const ROSE_HL = "#ec7c8e4d";
const LILAC_HL = "#a993f74d";

/* ------------------------------------------------------------------ content */

const TECH_CHIPS = [
  "Argon2id key derivation",
  "XChaCha20-Poly1305",
  "0G Private Computer",
  "0G Storage",
  "Arkiv DB-chain",
  "thirdweb in-app wallet",
  "Zero trackers",
  "Expiring share links",
  "Doctor-ready PDF",
  "Verification ID on every AI answer",
];

const FLOW_STEPS: { tag: string; title: string; body: string; detail: ReactNode; tone: string }[] = [
  {
    tag: "01 · Sign in",
    title: "Your email opens a wallet, not a database row.",
    body: "Signing in with an email code creates a self-custodial thirdweb in-app wallet. Its address is your identity on the network. It signs your records, so only you can create, extend or delete them. It never encrypts health data.",
    detail: <Mono lines={["email → one-time code", "→ in-app wallet 0xA1c4…92fE", "→ owns your Arkiv records"]} />,
    tone: "bg-card",
  },
  {
    tag: "02 · Create password",
    title: "A key that only your password can unlock.",
    body: "Your password goes through Argon2id (64 MiB of memory, on your device) to derive a key-encryption key. That key wraps a random 256-bit data key. The password itself is never stored or sent anywhere, and nobody can reset it.",
    detail: <Mono lines={["password ─Argon2id→ KEK", "random 256-bit DK", "seal(DK, KEK) → wrapped DK"]} />,
    tone: "bg-card-2",
  },
  {
    tag: "03 · Log your day",
    title: "Every entry is sealed before it is saved.",
    body: "Flow, symptoms, mood, sleep and notes are encrypted with XChaCha20-Poly1305 using your data key, then stored in your browser. Each blob is bound to its purpose, so an entry can never be passed off as a backup or a share.",
    detail: <Mono lines={["{flow, symptoms, mood…}", "→ XChaCha20-Poly1305(DK)", "→ IndexedDB on this device"]} />,
    tone: "bg-card",
  },
  {
    tag: "04 · Back up",
    title: "Decentralized storage, holding only ciphertext.",
    body: "Your vault backs itself up as one encrypted bundle on 0G Storage, addressed by its Merkle root. A small record on the Arkiv DB-chain, owned by your wallet, points to it and holds your wrapped key. Sign in anywhere, enter your password, and it's back.",
    detail: <Mono lines={["bundle → 0G Storage (root 0x9c…)", "Arkiv record ← your wallet", "{ wrappedDk, backupRoot }"]} />,
    tone: "bg-card-2",
  },
  {
    tag: "05 · Ask the AI",
    title: "Private AI that shows its receipt.",
    body: "To ask a question, the browser builds a small anonymized excerpt: dates become \"days ago\", and names, emails and numbers are scrubbed. It goes to 0G Private Computer. Each answer returns a Verification ID you can check, and nothing is kept.",
    detail: <Mono lines={["excerpt (no dates, no names)", "→ 0G Private Computer", "← answer + Verification ID"]} />,
    tone: "bg-card",
  },
];

type Access = "full" | "chosen" | "summary" | "excerpt" | "none";
const AUDIENCES: { who: string; what: string; access: Record<string, Access>; note: string }[] = [
  {
    who: "You",
    what: "The only key holder",
    access: { dates: "full", symptoms: "full", mood: "full", notes: "full", ai: "full" },
    note: "Everything, on any device, after your password.",
  },
  {
    who: "Your doctor",
    what: "Shared Access Link",
    access: { dates: "chosen", symptoms: "chosen", mood: "chosen", notes: "chosen", ai: "none" },
    note: "Only the scope you pick. Expires in 1 hour to 90 days. Revocable anytime.",
  },
  {
    who: "Your partner",
    what: "Partner view",
    access: { dates: "summary", symptoms: "none", mood: "chosen", notes: "none", ai: "none" },
    note: "Phase and next period only. Mood only if you opt in.",
  },
  {
    who: "The AI",
    what: "0G Private Computer",
    access: { dates: "excerpt", symptoms: "excerpt", mood: "excerpt", notes: "excerpt", ai: "none" },
    note: "Anonymized excerpt for one request. Never stored.",
  },
  {
    who: "Moonvault & the network",
    what: "Servers, 0G, Arkiv",
    access: { dates: "none", symptoms: "none", mood: "none", notes: "none", ai: "none" },
    note: "Ciphertext only. No key, no plaintext, no trackers.",
  },
];

const PARTNERS = [
  {
    name: "0G",
    role: "Private AI + decentralized storage",
    body: "0G Private Computer runs every AI request (insights, questions, voice logging, read-aloud) and returns a request ID as proof. 0G Storage keeps your encrypted vault backup, content-addressed by its Merkle root.",
    badge: "Compute · Storage",
  },
  {
    name: "Arkiv",
    role: "Ownable records on a DB-chain",
    body: "Your account record (wrapped key + backup pointer) and every share link live as Arkiv entities owned by your wallet, with built-in expiry. Share links simply stop existing when time is up.",
    badge: "Records · Expiry",
  },
  {
    name: "thirdweb",
    role: "Email sign-in & in-app wallets",
    body: "Email code sign-in creates a self-custodial wallet for you. There are no seed phrases to copy and no extensions. It is your identity and signer across devices.",
    badge: "Auth · Wallet",
  },
  {
    name: "libsodium",
    role: "Audited on-device cryptography",
    body: "Argon2id for key derivation and XChaCha20-Poly1305 for authenticated encryption. Everything runs in your browser, before anything touches the network.",
    badge: "Encryption",
  },
];

const FEATURES = [
  { title: "Cycle calendar", body: "See period, fertile window, ovulation and luteal days, each colored by phase, with a confidence note on every prediction." },
  { title: "Speak your day", body: "Say \"heavy flow, cramps, slept six hours\" and 0G turns it into a structured log you can review." },
  { title: "Daily AI analysis", body: "Tap any day to see what your own history says about that point in your cycle." },
  { title: "Doctor summary", body: "Turn six months of notes into a one-page PDF, built entirely in your browser." },
  { title: "Partner view", body: "Let a partner see your phase and next period, and nothing more." },
  { title: "Works offline", body: "Log without signal. Encrypted backups catch up on their own when you're back online." },
];

/* ------------------------------------------------------------------ helpers */

function Mono({ lines }: { lines: string[] }) {
  return (
    <div className="comic-sm rounded-xl bg-card p-3 font-mono text-[11px] leading-relaxed text-muted sm:text-xs">
      {lines.map((l) => (
        <div key={l} className="whitespace-pre-wrap">
          {l}
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-accent">
      <ScrambleIn text={children} scrambleSpeed={30} scrambledClassName="text-faint" />
    </p>
  );
}

function AccessCell({ a }: { a: Access }) {
  const map: Record<Access, { label: string; cls: string }> = {
    full: { label: "Full", cls: "bg-ok/10 text-ok border-ok/30" },
    chosen: { label: "If you choose", cls: "bg-accent/10 text-accent border-accent/30" },
    summary: { label: "Summary", cls: "bg-lav-soft text-lav border-lav/30" },
    excerpt: { label: "Anonymized", cls: "bg-gold/10 text-gold border-gold/30" },
    none: { label: "Never", cls: "bg-card-2 text-faint border-line" },
  };
  const m = map[a];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${m.cls}`}>{m.label}</span>;
}

/* ------------------------------------------------------------------ page */

export function Landing() {
  return (
    <div className="overflow-x-clip bg-bg">
      <main className="relative z-10 bg-bg">
        <Nav />
        <Hero />
        <TrustMarquee />
        <Stats />
        <HowItWorks />
        <Manifesto />
        <Permissions />
        <ZeroG />
        <Features />
        <Partners />
        <FinalCta />
      </main>
      <StickyFooter height={460}>
        <Footer />
      </StickyFooter>
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <MoonMark />
          <span className="font-display text-xl">Moonvault</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex" aria-label="Sections">
          <a href="#how" className="hover:text-text">
            <CenterUnderline>How it works</CenterUnderline>
          </a>
          <a href="#permissions" className="hover:text-text">
            <CenterUnderline>Permissions</CenterUnderline>
          </a>
          <a href="#zerog" className="hover:text-text">
            <CenterUnderline>0G AI</CenterUnderline>
          </a>
          <a href="#partners" className="hover:text-text">
            <CenterUnderline>Partners</CenterUnderline>
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/unlock" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-card-2 sm:inline-flex">
            Sign in
          </Link>
          <Link href="/signup" className="comic-sm comic-hover inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            Create vault
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Private period tracking</p>
      <h1 className="font-display mt-5 text-[2.8rem] leading-[1.05] sm:text-7xl">
        Your cycle,
        <br />
        <span className="bg-gradient-to-r from-gold via-accent to-rose bg-clip-text text-transparent">kept in your vault.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
        Moonvault tracks your period, symptoms, mood, and sleep while encrypting everything on your device first. Get thoughtful AI insights, a doctor-ready summary, and sharing that expires on its own.
      </p>
      <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/signup"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-8 font-semibold text-accent-ink shadow-[0_8px_30px_-8px_#f2a65a88] hover:brightness-110"
        >
          Create your vault
        </Link>
        <Link href="/unlock" className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-8 font-semibold hover:bg-card-2">
          I already have a vault
        </Link>
      </div>
      <p className="mt-5 text-xs text-faint">Free · Email sign-in · No ads, no trackers</p>
    </section>
  );
}

function TrustMarquee() {
  return (
    <section className="overflow-hidden border-y border-line bg-card py-4" aria-label="Technology">
      <SimpleMarquee baseVelocity={2.5} direction="left" slowdownOnHover slowDownFactor={0.2} useScrollVelocity repeat={4} draggable grabCursor>
        {TECH_CHIPS.map((t) => (
          <span key={t} className="comic-sm mx-2 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-bg px-4 py-1.5 text-sm font-medium">
            <span className="text-accent">✦</span>
            {t}
          </span>
        ))}
      </SimpleMarquee>
    </section>
  );
}

function Stats() {
  const items: { n: number; suffix?: string; label: string; sub: string }[] = [
    { n: 0, label: "readable bytes on our servers", sub: "Backups, records and links are ciphertext" },
    { n: 256, suffix: "-bit", label: "data key per vault", sub: "Random, generated on your device" },
    { n: 64, suffix: " MiB", label: "Argon2id memory cost", sub: "Makes password guessing expensive" },
    { n: 90, suffix: " days", label: "max life of a share link", sub: "Or 1 hour. You choose, and can revoke" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="comic rounded-2xl bg-card p-5">
            <p className="font-display text-4xl sm:text-5xl">
              <NumberTicker from={it.n === 0 ? 100 : 0} target={it.n} />
              <span className="text-2xl text-accent sm:text-3xl">{it.suffix}</span>
            </p>
            <p className="mt-2 text-sm font-semibold">{it.label}</p>
            <p className="mt-1 text-xs text-muted">{it.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-t border-line bg-bg-2/60">
      <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <SectionLabel>How your data stays yours</SectionLabel>
        <h2 className="font-display mt-3 max-w-3xl text-4xl leading-tight sm:text-5xl">
          From your fingertips to decentralized storage, <span className="text-accent">without anyone else holding the key.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-muted">Scroll through what happens to a single log entry.</p>
      </div>
      <StackingCards totalCards={FLOW_STEPS.length} scaleMultiplier={0.03} className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {FLOW_STEPS.map((s, i) => (
          <StackingCardItem key={s.tag} index={i} className="h-[560px] sm:h-[460px]" topPosition={`${6 + i * 2.5}%`}>
            <div className={`comic grid h-[440px] gap-6 overflow-hidden rounded-3xl p-6 sm:h-[340px] sm:grid-cols-[1.3fr_1fr] sm:p-10 ${s.tone}`}>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent">{s.tag}</span>
                <h3 className="font-display mt-3 text-2xl leading-snug sm:text-4xl">{s.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">{s.body}</p>
              </div>
              <div className="flex items-end sm:items-center">
                <div className="w-full">{s.detail}</div>
              </div>
            </div>
          </StackingCardItem>
        ))}
      </StackingCards>
    </section>
  );
}

function Manifesto() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
      <p className="font-display text-3xl leading-snug sm:text-5xl sm:leading-tight">
        We can&apos;t read your cycle. Not because we{" "}
        <TextHighlighter highlightColor={ROSE_HL} className="px-1">
          promise not to
        </TextHighlighter>
        , but because we{" "}
        <TextHighlighter highlightColor={PEACH} transition={{ type: "spring", duration: 1, delay: 0.4, bounce: 0 }} className="px-1">
          never hold the key.
        </TextHighlighter>
      </p>
      <p className="mx-auto mt-8 max-w-2xl text-muted">
        Period data is some of the most sensitive data a person can generate. Moonvault is built so that subpoenas, breaches and data brokers find{" "}
        <TextHighlighter highlightColor={LILAC_HL} transition={{ type: "spring", duration: 1, delay: 0.8, bounce: 0 }}>
          nothing but ciphertext
        </TextHighlighter>
        .
      </p>
    </section>
  );
}

function Permissions() {
  const cols: { key: string; label: string }[] = [
    { key: "dates", label: "Period dates" },
    { key: "symptoms", label: "Symptoms" },
    { key: "mood", label: "Mood & sleep" },
    { key: "notes", label: "Private notes" },
  ];
  return (
    <section id="permissions" className="scroll-mt-20 border-y border-line bg-card">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionLabel>Permissions</SectionLabel>
            <h2 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">
              You decide what
              <TextRotate
                texts={["your doctor", "your partner", "the AI", "nobody else"]}
                as="span"
                mainClassName="text-accent"
                splitLevelClassName="overflow-hidden pb-1"
                staggerFrom="first"
                staggerDuration={0.02}
                rotationInterval={2400}
              />
              gets to see.
            </h2>
            <p className="mt-4 text-muted">
              Ownership here is concrete. Your wallet owns your records on Arkiv. Your password is the only way to decrypt them. Every share is a separate, scoped copy encrypted with its own key, which lives in the link&apos;s{" "}
              <code className="rounded bg-card-2 px-1 font-mono text-xs">#fragment</code> and never reaches a server.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                ["Scoped", "Dates only, dates + symptoms, or the full log."],
                ["Time-boxed", "Links expire on-chain, from 1 hour to 90 days."],
                ["Revocable", "Revoke any link in one tap from the Share tab."],
                ["Portable", "Export or delete everything, anytime."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="comic-sm mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs text-accent">✓</span>
                  <span>
                    <strong>{t}.</strong> <span className="text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="comic overflow-hidden rounded-3xl bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-line bg-card-2 text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Who</th>
                    {cols.map((c) => (
                      <th key={c.key} className="px-3 py-3 font-semibold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AUDIENCES.map((a) => (
                    <tr key={a.who} className="border-b border-line align-top last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{a.who}</p>
                        <p className="text-xs text-faint">{a.what}</p>
                        <p className="mt-1 max-w-[180px] text-xs text-muted">{a.note}</p>
                      </td>
                      {cols.map((c) => (
                        <td key={c.key} className="px-3 py-3">
                          <AccessCell a={a.access[c.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ZeroG() {
  return (
    <section id="zerog" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <SectionLabel>Powered by 0G</SectionLabel>
      <h2 className="font-display mt-3 text-4xl leading-tight sm:text-6xl">
        <ScrollAndSwapText className="text-accent">Verifiable</ScrollAndSwapText> AI. <br className="sm:hidden" />
        <ScrollAndSwapText>Decentralized</ScrollAndSwapText> storage.
      </h2>
      <p className="mt-4 max-w-2xl text-muted">
        Moonvault&apos;s AI runs on the 0G Private Computer, an OpenAI-compatible router over decentralized GPU providers that supports TEE-backed private routing. Your encrypted backups live on 0G Storage. Our server only forwards anonymized excerpts and ciphertext. It never sees your key.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <div className="comic rounded-3xl bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">AI Insights · sample</p>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-ok/10 px-2 py-0.5 font-mono text-[11px] text-ok">0G Private Computer</span>
          </div>
          <h3 className="font-display mt-2 text-2xl">Your patterns</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>• Cramps appeared on cycle days 1–2 in 3 of 4 cycles.</li>
            <li>• Mood dipped 2–3 days before your period in most cycles.</li>
            <li>• Sleep ran about 40 minutes shorter in your luteal phase.</li>
            <li>
              <strong className="text-text">This week:</strong> energy usually picks up a few days after your period ends.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-faint">
            Verification ID:
            <span className="rounded-md border border-line px-1.5 py-0.5 font-mono">7d2e19a0…c41b8</span>
            <span>· proves which 0G request produced this answer</span>
          </div>
          <ol className="mt-6 grid gap-2 border-t border-line pt-5 text-xs sm:grid-cols-4">
            {[
              ["Your browser", "decrypts & anonymizes"],
              ["Moonvault API", "fixed tasks only, no logs"],
              ["0G router", "picks a provider (TEE optional)"],
              ["Your vault", "stores answer + request ID"],
            ].map(([t, d], i) => (
              <li key={t} className="comic-sm relative rounded-xl bg-bg p-3">
                <span className="font-mono text-[10px] text-faint">step {i + 1}</span>
                <p className="font-semibold">{t}</p>
                <p className="text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-5">
          {[
            ["Private Computer", "Insights, questions, voice-to-log (Whisper) and read-aloud run through 0G. TEE/private trust modes are supported."],
            ["Storage", "Encrypted vault bundles are uploaded to 0G Storage and addressed by Merkle root. A server cache makes restores instant."],
            ["Request receipts", "Every AI answer stores its 0G request ID in your vault, next to the answer itself."],
          ].map(([t, d]) => (
            <div key={t} className="comic-sm comic-hover rounded-2xl bg-card p-5">
              <h4 className="font-semibold">
                <ScrambleHover text={t} scrambleSpeed={40} maxIterations={8} scrambledClassName="text-accent" />
              </h4>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="border-y border-line bg-bg-2/60">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionLabel>Everything you need</SectionLabel>
        <h2 className="font-display mt-3 text-4xl sm:text-5xl">A thoughtful tracker, first.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="comic comic-hover rounded-2xl bg-card p-6">
              <span className="font-mono text-xs text-faint">0{i + 1}</span>
              <h3 className="font-display mt-2 text-2xl">
                <ScrambleHover text={f.title} scrambleSpeed={35} maxIterations={8} scrambledClassName="text-accent" />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Partners() {
  return (
    <section id="partners" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <SectionLabel>Built with</SectionLabel>
      <h2 className="font-display mt-3 text-4xl sm:text-5xl">Our partners in privacy.</h2>
      <p className="mt-4 max-w-2xl text-muted">Moonvault composes open infrastructure, so no single company, including us, can hold your data hostage.</p>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PARTNERS.map((p) => (
          <article key={p.name} className="comic comic-hover flex flex-col rounded-3xl bg-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-3xl">{p.name}</h3>
                <p className="text-sm font-semibold text-accent">{p.role}</p>
              </div>
              <span className="comic-sm rounded-full bg-bg px-3 py-1 font-mono text-[11px] text-muted">{p.badge}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{p.body}</p>
          </article>
        ))}
      </div>
      <div className="mt-10 overflow-hidden">
        <SimpleMarquee baseVelocity={3} direction="right" repeat={4}>
          {["0G Private Computer", "0G Storage", "Arkiv DB-chain", "thirdweb", "libsodium", "Next.js", "ETHGlobal Mumbai 2026"].map((n) => (
            <span key={n} className="font-display mx-6 whitespace-nowrap text-3xl text-faint sm:text-4xl">
              {n} <span className="text-accent">✦</span>
            </span>
          ))}
        </SimpleMarquee>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="comic relative overflow-hidden rounded-[28px] bg-card px-6 py-16 text-center sm:px-12">
        <AnimatedGradient colors={PEACH_PASTEL.slice().reverse()} speed={16} blur="heavy" className="opacity-[0.12]" />
        <div className="pointer-events-none absolute right-6 top-6 hidden h-36 w-36 text-faint lg:block">
          <TextAlongPath
            path="M 100,100 m -80,0 a 80,80 0 1,1 160,0 a 80,80 0 1,1 -160,0"
            viewBox="0 0 200 200"
            text="ENCRYPTED ON YOUR DEVICE ✦ OWNED BY YOUR WALLET ✦ "
            textClassName="font-mono text-[10px] tracking-[0.2em]"
            duration={24}
          />
        </div>
        <div className="relative">
          <h2 className="font-display text-4xl leading-tight sm:text-6xl">
            Your body. Your data. <br />
            <ScrollAndSwapText className="text-accent" offset={["0 1", "0 0.6"]}>
              Your key.
            </ScrollAndSwapText>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">Set up your vault in under a minute. All you need is an email and a password only you know.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="comic comic-hover inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-8 font-semibold text-accent-ink">
              Create your vault
            </Link>
            <Link href="/partner" className="comic-sm comic-hover inline-flex min-h-12 items-center justify-center rounded-full bg-card px-8 font-semibold">
              Open a partner invite
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="flex h-full flex-col justify-between border-t border-ink bg-bg-2 px-4 pb-6 pt-12 text-text sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-8 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MoonMark />
            <span className="font-display text-xl text-text">Moonvault</span>
          </div>
          <p className="text-xs leading-relaxed text-muted">A private, encrypted period tracker with verifiable AI on 0G and ownable records on Arkiv.</p>
        </div>
        <FooterCol title="Product" links={[["/signup", "Create vault"], ["/unlock", "Sign in"], ["/restore", "Restore a backup"], ["/partner", "Partner view"]]} />
        <FooterCol title="Learn" links={[["#how", "How it works"], ["#permissions", "Permissions"], ["#zerog", "0G AI & storage"], ["#partners", "Partners"]]} />
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text">Privacy</h4>
          <p className="text-xs leading-relaxed text-muted">No ads, no analytics, no plaintext on any server. Your key never leaves your device.</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-ok">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Zero telemetry
          </span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl">
        <p className="font-display select-none text-[18vw] leading-none tracking-tight text-line sm:text-[12vw] lg:text-[150px]">moonvault</p>
        <div className="mt-2 flex flex-col items-center justify-between gap-2 border-t border-line pt-4 text-[11px] text-faint sm:flex-row">
          <p>Informational only, not medical advice. · MIT open source</p>
          <p>Built with 0G, Arkiv, thirdweb and libsodium.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text">{title}</h4>
      <ul className="space-y-2 text-xs text-muted">
        {links.map(([href, label]) => (
          <li key={href}>
            {href.startsWith("#") ? (
              <a href={href} className="hover:text-text">
                <CenterUnderline>{label}</CenterUnderline>
              </a>
            ) : (
              <Link href={href} className="hover:text-text">
                <CenterUnderline>{label}</CenterUnderline>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
