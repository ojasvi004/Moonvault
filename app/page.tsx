import Link from "next/link";
import { MoonMark } from "@/components/ui";

const FEATURES = [
  {
    title: "Encrypted before it leaves your hands",
    body: "Every entry is locked on your device with a passphrase only you know. We can't read it. Nobody can.",
  },
  {
    title: "Private AI that does real work",
    body: "Speak your day and get a structured log. Ask about your cycle. Spot patterns. Every answer carries a Verification ID.",
  },
  {
    title: "A summary your doctor can use",
    body: "Turn six months of notes into a clean one-page PDF, built right in your browser.",
  },
  {
    title: "Share on your terms",
    body: "Send a Shared Access Link with just the details you choose. It expires on its own, or revoke it in one tap.",
  },
  {
    title: "Encrypted Cloud Backup",
    body: "Your vault backs itself up, fully encrypted. Lose your phone? Sign in anywhere and restore in one step.",
  },
  {
    title: "Predictions that admit uncertainty",
    body: "Next period, fertile window and ovulation estimates, with an honest confidence note.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <MoonMark />
          <span className="font-display text-lg">Moonvault</span>
        </Link>
        <Link href="/unlock" className="rounded-full border border-line px-4 py-2 text-sm hover:bg-card-2">
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[1.2fr_1fr] md:pt-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Private period tracking</p>
            <h1 className="font-display mt-4 text-[2.6rem] leading-[1.05] sm:text-6xl">
              Your cycle,
              <br />
              <span className="bg-gradient-to-r from-gold via-accent to-rose bg-clip-text text-transparent">kept in your vault.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Moonvault tracks your period, symptoms, mood and sleep — and encrypts all of it on your device first. Thoughtful AI insights, a doctor-ready
              summary, and sharing that expires on its own.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 font-semibold text-accent-ink shadow-[0_8px_30px_-8px_#f2a65a88] hover:brightness-110">
                Create your vault
              </Link>
              <Link href="/restore" className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-7 font-semibold hover:bg-card-2">
                Restore on this device
              </Link>
            </div>
            <p className="mt-4 text-xs text-faint">Free · Email sign-in · No ads, no trackers</p>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-sm">
            <div className="moon-glow absolute inset-6 rounded-full bg-gradient-to-br from-[#2b1f45] to-[#120e22]" />
            <svg viewBox="0 0 200 200" className="absolute inset-0" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => {
                const a = (i / 28) * Math.PI * 2 - Math.PI / 2;
                const r = 86;
                const kind = i < 5 ? "#ec7c8e" : i >= 9 && i <= 15 ? (i === 14 ? "#f7d27a" : "#a993f7") : "#3a3160";
                return <circle key={i} cx={100 + r * Math.cos(a)} cy={100 + r * Math.sin(a)} r={i === 14 ? 5 : 3.6} fill={kind} />;
              })}
              <path d="M118 52a52 52 0 1 0 30 80 44 44 0 0 1-30-80Z" fill="#f5ede4" opacity=".92" />
            </svg>
            <div className="absolute bottom-2 left-1/2 w-max -translate-x-1/2 rounded-full border border-line bg-card px-4 py-1.5 text-xs text-muted">
              <span className="text-rose">●</span> period <span className="ml-2 text-lav">●</span> fertile <span className="ml-2 text-gold">●</span> ovulation
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="card p-6">
                <h2 className="font-display text-xl">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
          <h2 className="font-display text-3xl">How your privacy works</h2>
          <ol className="mt-8 grid gap-4 text-left sm:grid-cols-3">
            {[
              ["1", "You choose a passphrase", "It never leaves your device and is never stored."],
              ["2", "Your data is sealed", "Entries and backups are encrypted with a key only your passphrase can unlock."],
              ["3", "Only you hold the key", "Backups and shared links contain nothing readable without it."],
            ].map(([n, t, b]) => (
              <li key={n} className="card p-5">
                <span className="font-display text-2xl text-accent">{n}</span>
                <h3 className="mt-1 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{b}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line/60 py-6 text-center text-xs text-faint">
        Moonvault offers information, not medical advice. · Open source (MIT)
      </footer>
    </div>
  );
}
