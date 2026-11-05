import Link from "next/link";
import type { ReactNode } from "react";
import { MoonMark } from "./ui";

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
        <div className="card mt-6 p-5 sm:p-6">{children}</div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </main>
    </div>
  );
}
