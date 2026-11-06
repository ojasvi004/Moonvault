"use client";
import Link from "next/link";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "ghost" | "soft" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-105 shadow-[0_4px_16px_-4px_#e0833266]",
  ghost: "border border-line text-text hover:bg-card-2",
  soft: "bg-card-2 text-text hover:bg-line/40",
  danger: "border border-bad/50 text-bad hover:bg-bad/10",
};

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[0.95rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", className = "", children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[0.95rem] font-semibold transition ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Spinner({ small, label }: { small?: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <span className={`spin inline-block rounded-full border-2 border-current border-r-transparent ${small ? "h-4 w-4" : "h-6 w-6"}`} />
      {label && <span className="text-sm text-muted">{label}</span>}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent/90">{children}</p>;
}

export function PageTitle({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: ReactNode }) {
  return (
    <header className="mb-6 sm:mb-8">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="font-display mt-1 text-3xl sm:text-4xl">{title}</h1>
      {sub && <p className="mt-2 max-w-2xl text-muted">{sub}</p>}
    </header>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-card-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-rose to-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      {label && (
        <p className="mt-1.5 text-xs text-muted">
          {label} · {pct}%
        </p>
      )}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-bad/40 bg-bad/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry} className="shrink-0">
          Try again
        </Button>
      )}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "ok" | "warn" }) {
  const c = tone === "ok" ? "border-ok/40 bg-ok/10" : tone === "warn" ? "border-warn/40 bg-warn/10" : "border-line bg-card-2/60";
  return <div className={`rounded-2xl border p-4 text-sm ${c}`}>{children}</div>;
}

/** Small, copyable verification ID shown on every AI result. */
export function VerificationId({ ids, mock }: { ids: string[]; mock?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-faint">
      <span title="Private compute request ID for this answer">Verification ID{ids.length > 1 ? "s" : ""}{mock ? " (demo)" : ""}:</span>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(id);
            setCopied(id);
            setTimeout(() => setCopied(null), 1500);
          }}
          className="rounded-md border border-line px-1.5 py-0.5 font-mono hover:text-text"
          aria-label={`Copy verification ID ${id}`}
        >
          {copied === id ? "copied ✓" : id.length > 22 ? `${id.slice(0, 10)}…${id.slice(-8)}` : id}
        </button>
      ))}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="text-xs text-faint">
      Informational only, not medical advice or a diagnosis. For anything that worries you, please talk to a doctor.
    </p>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function MoonMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="mv-g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f7d27a" />
          <stop offset="1" stopColor="#ec7c8e" />
        </linearGradient>
      </defs>
      <path d="M21.5 4.5a12 12 0 1 0 6 18.5A10 10 0 0 1 21.5 4.5Z" fill="url(#mv-g)" />
      <rect x="9" y="14" width="9" height="7" rx="2" fill="#0d0a18" opacity=".85" />
      <path d="M11 14v-2a2.5 2.5 0 0 1 5 0v2" stroke="#0d0a18" strokeWidth="1.6" fill="none" opacity=".85" />
    </svg>
  );
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function countdown(ms: number): string {
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${mm}m left`;
  return `${Math.max(1, mm)}m left`;
}

export { errMsg } from "@/lib/util/errors";
