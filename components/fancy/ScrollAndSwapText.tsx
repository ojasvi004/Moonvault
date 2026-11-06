"use client";
// Adapted from fancy components "Scroll And Swap Text" (MIT, see LICENSE.md).
// Text slides up and is replaced by a copy of itself as the element scrolls through the viewport.
import { useRef, type ElementType, type RefObject } from "react";
import { motion, useScroll, useSpring, useTransform, type UseScrollOptions } from "motion/react";
import { cn } from "./cn";

interface ScrollAndSwapTextProps {
  children: string;
  as?: ElementType;
  /** Scroll container; omit to track the window. */
  containerRef?: RefObject<HTMLElement | null>;
  offset?: UseScrollOptions["offset"];
  className?: string;
  springConfig?: { stiffness?: number; damping?: number; mass?: number };
}

export default function ScrollAndSwapText({
  children,
  as = "span",
  offset = ["0 0.9", "0 0.45"],
  className,
  containerRef,
  springConfig = { stiffness: 200, damping: 30 },
}: ScrollAndSwapTextProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ ...(containerRef && { container: containerRef }), target: ref, offset });
  const spring = useSpring(scrollYProgress, springConfig);
  const top = useTransform(spring, [0, 1], ["0%", "-100%"]);
  const bottom = useTransform(spring, [0, 1], ["100%", "0%"]);
  const Tag = as;

  return (
    <Tag className={cn("relative inline-flex items-center justify-center overflow-hidden p-0 align-top", className)} ref={ref}>
      <span className="relative text-transparent" aria-hidden="true">
        {children}
      </span>
      <motion.span className="absolute" style={{ top }}>
        {children}
      </motion.span>
      <motion.span className="absolute" style={{ top: bottom }} aria-hidden="true">
        {children}
      </motion.span>
    </Tag>
  );
}
