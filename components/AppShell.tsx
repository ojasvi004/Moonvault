"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { lock } from "@/lib/vault/session";
import { startBackupManager } from "@/lib/backup/manager";
import { syncProfile } from "@/lib/vault/profileSync";
import { MOCK_SERVICES } from "@/lib/config";
import { useAuth, useBackupStatus, useOnline, useUnlocked } from "./hooks";
import { MoonMark, Spinner, timeAgo } from "./ui";

const NAV = [
  { href: "/calendar", label: "Today", icon: "M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5L16 7M8 16l-1.5 1.5m0-11L8 8m8 8 1.5 1.5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  { href: "/log", label: "Log", icon: "M12 5v14M5 12h14" },
  { href: "/history", label: "History", icon: "M4 19V9m6 10V5m6 14v-7m4 7H3" },
  { href: "/ask", label: "Insights", icon: "M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3Zm6 11 .9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z" },
  { href: "/share", label: "Share", icon: "M8.6 13.5l6.8 4M15.4 6.5l-6.8 4M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
  { href: "/settings", label: "Vault", icon: "M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5V11Z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function SyncBadge() {
  const s = useBackupStatus();
  const online = useOnline();
  let text: string;
  let tone = "text-muted";
  if (!online || s.state === "offline") {
    text = s.pending ? `Offline · ${s.pending} waiting` : "Offline";
    tone = "text-warn";
  } else if (s.state === "running") {
    text = `Backing up ${Math.round((s.progress ?? 0) * 100)}%`;
    tone = "text-accent";
  } else if (s.state === "error") {
    text = s.pending ? `Backup pending · ${s.pending}` : "Backup pending";
    tone = "text-warn";
  } else if (s.pending > 0) {
    text = `${s.pending} change${s.pending > 1 ? "s" : ""} waiting`;
  } else if (s.lastBackupAt) {
    text = `Backed up ${timeAgo(s.lastBackupAt)}`;
    tone = "text-ok";
  } else {
    text = "Not backed up yet";
  }
  return (
    <Link href="/settings" className={`inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs ${tone}`} title="Encrypted Cloud Backup status">
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${s.state === "running" ? "animate-pulse" : ""}`} />
      {text}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const unlocked = useUnlocked();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (auth.status === "loading") return;
    if (auth.status === "signedOut" || !unlocked) router.replace(`/unlock?next=${encodeURIComponent(path + window.location.search)}`);
  }, [auth.status, unlocked, router, path]);

  useEffect(() => {
    if (!unlocked || auth.status !== "signedIn") return;
    startBackupManager();
    void syncProfile().catch(() => undefined); // background; retried on next unlock
  }, [unlocked, auth.status]);

  if (auth.status !== "signedIn" || !unlocked) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Opening your vault…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/calendar" className="flex items-center gap-2">
            <MoonMark />
            <span className="font-display text-lg">Moonvault</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${path.startsWith(n.href) ? "bg-card-2 text-text" : "text-muted hover:text-text"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <SyncBadge />
            <button onClick={() => lock()} className="rounded-full border border-line p-2 text-muted hover:text-text" aria-label="Lock vault" title="Lock vault">
              <Icon d="M6 11V8a6 6 0 1 1 12 0v3M5 11h14v10H5V11Z" />
            </button>
          </div>
        </div>
        {MOCK_SERVICES && (
          <div className="bg-warn/15 px-4 py-1 text-center text-[11px] text-warn">Demo mode: cloud services are simulated on this device.</div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label="Main">
        <ul className="grid grid-cols-6">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${active ? "text-accent" : "text-muted"}`}>
                  <Icon d={n.icon} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
