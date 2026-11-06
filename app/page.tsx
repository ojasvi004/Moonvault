import Link from "next/link";

const FEATURES = [
  {
    title: "Encrypted before it leaves your hands",
    body: "Every entry is locked on your device with a passphrase only you know. We cannot read it, and neither can anyone else.",
  },
  {
    title: "Private AI that does real work",
    body: "Speak your day, get a structured log, ask about your cycle, and spot patterns. Every answer carries a Verification ID.",
  },
  {
    title: "A summary your doctor can use",
    body: "Turn six months of notes into a clean one-page PDF, built right in your browser.",
  },
  {
    title: "Share on your terms",
    body: "Send a Shared Access Link with only the details you choose. It expires on its own, or you can revoke it in one tap.",
  },
  {
    title: "Encrypted cloud backup",
    body: "Your vault backs itself up fully encrypted. Sign in anywhere and restore it in one step.",
  },
  {
    title: "Predictions that admit uncertainty",
    body: "See next-period, fertile-window, and ovulation estimates with an honest confidence note.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="font-display text-lg">
          Moonvault
        </Link>
        <Link href="/unlock" className="rounded-full border border-line px-4 py-2 text-sm hover:bg-card-2">
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Private period tracking</p>
          <h1 className="font-display mt-5 text-[2.8rem] leading-[1.05] sm:text-7xl">
            Your cycle,
            <br />
            <span className="bg-gradient-to-r from-gold via-accent to-rose bg-clip-text text-transparent">
              kept in your vault.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Moonvault tracks your period, symptoms, mood, and sleep while encrypting everything on your device first.
            Get thoughtful AI insights, a doctor-ready summary, and sharing that expires on its own.
          </p>
          <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-8 font-semibold text-accent-ink shadow-[0_8px_30px_-8px_#f2a65a88] hover:brightness-110"
            >
              Create your vault
            </Link>
            <Link
              href="/unlock"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-8 font-semibold hover:bg-card-2"
            >
              I already have a vault
            </Link>
          </div>
          <p className="mt-5 text-xs text-faint">Free · Email sign-in · No ads, no trackers</p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="card p-6">
                <h2 className="font-display text-xl">{feature.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
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
            ].map(([number, title, body]) => (
              <li key={number} className="card p-5">
                <span className="font-display text-2xl text-accent">{number}</span>
                <h3 className="mt-1 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
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
