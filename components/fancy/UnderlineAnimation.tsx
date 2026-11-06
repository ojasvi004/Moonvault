"use client";
import { type ReactNode } from "react";

export function UnderlineAnimation({
  children,
  color = "#e08332",
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <svg
        className="absolute -bottom-2 left-0 w-full overflow-visible pointer-events-none"
        height="10"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M 1 7 Q 50 1, 99 7"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
