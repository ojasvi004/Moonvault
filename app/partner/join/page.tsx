"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthFrame } from "@/components/AuthFrame";
import { EmailLogin } from "@/components/EmailLogin";
import { useAuth } from "@/components/hooks";
import { PartnerSummary } from "@/components/PartnerSummary";
import { Button, ErrorBox, Notice, Spinner, errMsg } from "@/components/ui";
import { signOut } from "@/lib/auth/auth";
import { acceptInvite, parseInvite, previewInvite, type PartnerPackage } from "@/lib/partner/partner";

type State =
  | { k: "loading" }
  | { k: "bad"; msg: string }
  | { k: "ready"; id: string; key: Uint8Array; pkg: PartnerPackage; owner: string; claimedBy: string | null };

export default function JoinPartnerPage() {
  const auth = useAuth();
  const router = useRouter();
  const [state, setState] = useState<State>({ k: "loading" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const address = auth.status === "signedIn" ? auth.address.toLowerCase() : null;

  useEffect(() => {
    if (!address) return;
    let alive = true;
    (async () => {
      const { id, key } = parseInvite(window.location.hash);
      const p = await previewInvite(id, key);
      if (alive) setState({ k: "ready", id, key, ...p });
    })().catch((e) => alive && setState({ k: "bad", msg: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [address]);

  async function accept() {
    if (state.k !== "ready") return;
    setErr(null);
    setBusy(true);
    try {
      await acceptInvite(state.id, state.key);
      router.replace("/partner");
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  }

  if (auth.status === "loading") {
    return (
      <AuthFrame title="Partner invite">
        <Spinner label="Loading…" />
      </AuthFrame>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <AuthFrame title="You've been invited" sub="Someone wants to share their cycle with you on Moonvault. Sign in with your email (it's free) to connect.">
        <EmailLogin cta="Send me a code" />
      </AuthFrame>
    );
  }

  if (state.k === "loading") {
    return (
      <AuthFrame title="Partner invite">
        <Spinner label="Opening your invite…" />
      </AuthFrame>
    );
  }

  if (state.k === "bad") {
    return (
      <AuthFrame title="Partner invite" footer={<Link href="/partner">Go to partner view</Link>}>
        <ErrorBox message={state.msg} />
      </AuthFrame>
    );
  }

  const own = state.owner === address;
  const usedByOther = !!state.claimedBy && state.claimedBy !== address;
  const already = state.claimedBy === address;

  return (
    <AuthFrame
      title={`${state.pkg.ownerName} wants to share their cycle with you`}
      sub={auth.email ? `Signed in as ${auth.email}` : undefined}
      footer={
        <button className="hover:text-text" onClick={() => void signOut()}>
          Use a different account
        </button>
      }
    >
      <div className="space-y-4">
        <PartnerSummary pkg={state.pkg} preview />
        <p className="text-sm text-muted">
          You&apos;ll see their period days, predictions, current phase and fertile window estimates. You won&apos;t see symptoms, notes or anything else they keep private.
        </p>
        {own && <Notice tone="warn">This is your own invite. Send the link to your partner instead.</Notice>}
        {usedByOther && <Notice tone="warn">This invite was already accepted by another account. Ask for a new invite.</Notice>}
        {err && <ErrorBox message={err} />}
        <Button className="w-full" loading={busy} disabled={own || usedByOther} onClick={() => void accept()}>
          {already ? "Reconnect on this device" : busy ? "Connecting…" : "Connect"}
        </Button>
      </div>
    </AuthFrame>
  );
}
