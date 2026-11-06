"use client";
// Adapted from fancy components "Basic Number Ticker" (MIT, see LICENSE.md).
// Added: starts when scrolled into view, optional decimals.
import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useTransform, type ValueAnimationTransition } from "motion/react";
import { cn } from "./cn";

interface NumberTickerProps {
  from?: number;
  target: number;
  transition?: ValueAnimationTransition;
  decimals?: number;
  className?: string;
  onComplete?: () => void;
}

export default function NumberTicker({
  from = 0,
  target,
  transition = { duration: 2.2, type: "tween", ease: "easeInOut" },
  decimals = 0,
  className,
  onComplete,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const count = useMotionValue(from);
  const display = useTransform(count, (v) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  const cfg = useRef({ transition, onComplete });

  useEffect(() => {
    if (!inView) return;
    count.set(from);
    const controls = animate(count, target, { ...cfg.current.transition, onComplete: () => cfg.current.onComplete?.() });
    return () => controls.stop();
  }, [inView, from, target, count]);

  return (
    <motion.span ref={ref} className={cn("tabular-nums", className)}>
      {display}
    </motion.span>
  );
}
