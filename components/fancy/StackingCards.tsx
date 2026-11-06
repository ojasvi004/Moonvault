"use client";
import { type ReactNode } from "react";

export type StackCardItem = {
  id: string;
  tag: string;
  title: string;
  description: string;
  icon?: ReactNode;
  accent?: string;
};

export function StackingCards({
  items,
  className = "",
}: {
  items: StackCardItem[];
  className?: string;
}) {
  return (
    <div className={`space-y-6 ${className}`}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="sticky top-24 card p-6 sm:p-8 transition-transform duration-300 comic-shadow hover:-translate-y-1"
          style={{
            zIndex: index + 1,
            top: `calc(6rem + ${index * 1.25}rem)`,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              {item.tag}
            </span>
            <span className="font-mono text-xs text-faint">0{index + 1}</span>
          </div>
          <h3 className="font-display mt-3 text-2xl sm:text-3xl text-text">{item.title}</h3>
          <p className="mt-2 text-base text-muted leading-relaxed max-w-2xl">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
