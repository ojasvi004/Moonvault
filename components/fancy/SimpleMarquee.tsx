"use client";
import { type ReactNode } from "react";

export function SimpleMarquee({
  children,
  speed = 25,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden whitespace-nowrap select-none py-3 ${className}`}>
      <div
        className="animate-marquee items-center gap-8"
        style={{ animationDuration: `${speed}s` }}
      >
        <div className="flex shrink-0 items-center gap-8">{children}</div>
        <div className="flex shrink-0 items-center gap-8" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
