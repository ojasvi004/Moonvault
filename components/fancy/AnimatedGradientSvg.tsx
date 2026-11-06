"use client";
// Adapted from fancy components "Animated Gradient With SVG" (MIT, see LICENSE.md).
// Changes: deterministic (seeded) blob placement so server and client render the
// same markup, and a debounced ResizeObserver in place of use-debounced-dimensions.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "./cn";

interface AnimatedGradientProps {
  colors: string[];
  speed?: number;
  blur?: "light" | "medium" | "heavy";
  className?: string;
}

/** Peach pastel palette used across the landing page. */
export const PEACH_PASTEL = ["#ffd3bd", "#ffe6d6", "#fbd0dc", "#ffdcc4", "#f8e1f0", "#ffc8ad"];

function seeded(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function useDimensions(ref: React.RefObject<HTMLElement | null>) {
  const [dim, setDim] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(([entry]) => {
      clearTimeout(t);
      t = setTimeout(() => setDim({ width: entry.contentRect.width, height: entry.contentRect.height }), 150);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [ref]);
  return dim;
}

export default function AnimatedGradient({ colors, speed = 10, blur = "heavy", className }: AnimatedGradientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useDimensions(containerRef);
  const circleSize = Math.max(width, height);
  const blurClass = blur === "light" ? "blur-2xl" : blur === "medium" ? "blur-3xl" : "blur-[100px]";

  return (
    <div ref={containerRef} className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className={cn("absolute inset-0", blurClass)}>
        {circleSize > 0 &&
          colors.map((color, index) => {
            const r = seeded(index + 1);
            const size = circleSize * (0.5 + r());
            const style = {
              animation: `background-gradient ${speed}s infinite ease-in-out`,
              animationDelay: `${-index * (speed / colors.length)}s`,
              top: `${r() * 50}%`,
              left: `${r() * 50}%`,
              "--tx-1": r() - 0.5,
              "--ty-1": r() - 0.5,
              "--tx-2": r() - 0.5,
              "--ty-2": r() - 0.5,
              "--tx-3": r() - 0.5,
              "--ty-3": r() - 0.5,
              "--tx-4": r() - 0.5,
              "--ty-4": r() - 0.5,
            } as CSSProperties;
            return (
              <svg key={index} className="absolute" width={size} height={size} viewBox="0 0 100 100" style={style}>
                <circle cx="50" cy="50" r="50" fill={color} />
              </svg>
            );
          })}
      </div>
    </div>
  );
}
