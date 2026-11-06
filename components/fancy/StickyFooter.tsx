"use client";
import Link from "next/link";
import { MoonMark } from "@/components/ui";

export function StickyFooter() {
  return (
    <footer className="border-t border-line bg-card/60 backdrop-blur-md pt-12 pb-8 text-sm text-muted">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2 text-text">
              <MoonMark />
              <span className="font-display text-xl font-bold">Moonvault</span>
            </Link>
            <p className="text-xs text-muted leading-relaxed">
              The world&apos;s first truly private, encrypted-at-rest menstrual tracker with verifiable decentralized AI.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-text text-xs uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/signup" className="hover:text-text transition">
                  Create Vault
                </Link>
              </li>
              <li>
                <Link href="/unlock" className="hover:text-text transition">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/partner" className="hover:text-text transition">
                  Partner Cycle View
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-text text-xs uppercase tracking-wider mb-3">Technology</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-faint">Arkiv DB-Chain Testnet</span>
              </li>
              <li>
                <span className="text-faint">0G Verifiable Decentralized AI</span>
              </li>
              <li>
                <span className="text-faint">thirdweb In-App Wallet</span>
              </li>
              <li>
                <span className="text-faint">Libsodium Device Encryption</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-text text-xs uppercase tracking-wider mb-3">Privacy First</h4>
            <p className="text-xs text-faint leading-relaxed">
              We never track your IP, sell data, or host plain-text logs. Your key never leaves your device.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-mono text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Zero telemetry
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-line/60 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-faint gap-3">
          <p>Moonvault offers health tracking, not clinical medical diagnosis. · MIT Open Source</p>
          <p>© 2026 Moonvault. Built with Arkiv & 0G Compute.</p>
        </div>
      </div>
    </footer>
  );
}
