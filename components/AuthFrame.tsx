"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "./hooks";
import { MoonMark } from "./ui";

function ThirdwebMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
      <path d="M2 5.5h4.2l3 13H5zM8.6 5.5h4.2l3 13h-4.2zM15.2 5.5h4.3l2.5 6.5-1.6 6.5z" fill="currentColor" />
    </svg>
  );
}

/** Wallet status + "Powered by thirdweb", shown inside every sign-in / vault box. */
function WalletFooter() {
  const auth = useAuth();
  const addr = auth.status === "signedIn" ? auth.address : null;
  return (
    <div className="mt-5 space-y-2 border-t border-line pt-4">
      {addr && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-card-2/60 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Wallet connected
          </span>
          <span className="font-mono text-text" title={addr}>
            {addr.slice(0, 6)}…{addr.slice(-4)}
          </span>
        </div>
      )}
      <a
        href="https://thirdweb.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 text-[11px] text-faint hover:text-muted"
      >
        <span>Powered by</span>
        <span className="inline-flex items-center gap-1 font-semibold text-text">
          <ThirdwebMark />
          thirdweb
        </span>
        <span>· in-app wallet</span>
      </a>
    </div>
  );
}

export function AuthFrame({ title, sub, children, footer }: { title: string; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <MoonMark />
          <span className="font-display text-lg">Moonvault</span>
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
        {sub && <p className="mt-2 text-muted">{sub}</p>}
        <div className="card mt-6 p-5 sm:p-6">
          {children}
          <WalletFooter />
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </main>
    </div>
  );
}
