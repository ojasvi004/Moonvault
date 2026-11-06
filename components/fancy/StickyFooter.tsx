"use client";
// Adapted from fancy components "Sticky Footer" block (MIT, see LICENSE.md).
// The footer sits "under" the page and is revealed as the last section scrolls away:
// a clip-path window over a sticky element pinned to the bottom of the viewport.
import type { ReactNode } from "react";
import { cn } from "./cn";

export default function StickyFooter({ children, height = 520, className }: { children: ReactNode; height?: number; className?: string }) {
  return (
    <div className="relative" style={{ height, clipPath: "polygon(0% 0, 100% 0%, 100% 100%, 0 100%)" }}>
      <div className="relative -top-[100vh]" style={{ height: `calc(100vh + ${height}px)` }}>
        <div className={cn("sticky", className)} style={{ height, top: `calc(100vh - ${height}px)` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
