"use client";
import { type ReactNode } from "react";

export function TextHighlighter({
  children,
  color = "bg-rose/15 text-rose",
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`relative inline-block rounded-md px-1.5 py-0.5 font-semibold transition-colors duration-300 ${color} ${className}`}
    >
      {children}
    </span>
  );
}
