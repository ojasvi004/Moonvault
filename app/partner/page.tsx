"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { EmailLogin } from "@/components/EmailLogin";
import { useAuth } from "@/components/hooks";
import { PartnerSummary } from "@/components/PartnerSummary";
import { Button, Card, ErrorBox, Spinner, errMsg } from "@/components/ui";
import { signOut } from "@/lib/auth/auth";
import { leavePartner, loadPartnerViews, type PartnerView } from "@/lib/partner/partner";

/** What a partner sees after signing in. No vault or passphrase needed. */
export default function PartnerPage() {
  const auth = useAuth();
  const [views, setViews] = useState<PartnerView[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);

  const address = auth.status === "signedIn" ? auth.address : null;

  const load = useCallback(async () => {
    if (!address) return;
    setErr(null);
    try {
      setViews(await loadPartnerViews());
    } catch (e) {
      setErr(errMsg(e));
    }
  }, [address]);

  useEffect(() => {
    queueMicrotask(() => void load());
    if (!address) return;
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load, address]);

  async function leave(id: string) {
    if (!confirm("Disconnect? You'll stop seeing this cycle summary until you're invited again.")) return;
    setLeaving(id);
    try {
      await leavePartner(id);
      setViews((v) => v?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLeaving(null);
    }
  }

  if (auth.status === "loading") {
    return (
      <AuthFrame title="Partner view">
        <Spinner label="Loading…" />
      </AuthFrame>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <AuthFrame title="Partner view" sub="Sign in with the email your partner invited to see their cycle.">
        <EmailLogin cta="Send me a code" />
      </AuthFrame>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-lg">Moonvault</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/unlock" className="text-muted hover:text-text">
            My own vault
          </Link>
          <button className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-text" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Partner view</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">Shared with you</h1>
        <p className="mt-2 text-muted">{auth.email ? `Signed in as ${auth.email}. ` : ""}Read-only, end-to-end encrypted, and only what they chose to share.</p>

        <div className="mt-6 space-y-5">
          {err && <ErrorBox message={`Couldn't load: ${err}`} onRetry={() => void load()} />}
          {views === null && !err && <Spinner label="Opening shared summaries…" />}
          {views?.length === 0 && (
            <Card>
              <h2 className="font-display text-2xl">Nothing shared with you yet</h2>
              <p className="mt-2 text-sm text-muted">
                Ask your partner to open Moonvault → <strong>Share</strong> → <strong>Share with your partner</strong> and send you the invite. Open it while signed in with this email.
              </p>
            </Card>
          )}
          {views?.map((v) => (
            <Card key={v.id}>
              {"pkg" in v ? <PartnerSummary pkg={v.pkg} /> : <ErrorBox message={v.error} />}
              <div className="mt-5 flex justify-end">
                <Button variant="ghost" className="min-h-9 px-3 py-1.5 text-xs" loading={leaving === v.id} onClick={() => void leave(v.id)}>
                  Disconnect
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
