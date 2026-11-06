"use client";
// Adapted from fancy components "Underline Animation" (center variant, MIT, see LICENSE.md).
import { useEffect, useRef, type ReactNode } from "react";
import { motion, type ValueAnimationTransition } from "motion/react";
import { cn } from "./cn";

interface UnderlineProps {
  children: ReactNode;
  className?: string;
  transition?: ValueAnimationTransition;
  underlineHeightRatio?: number;
  underlinePaddingRatio?: number;
}

export default function CenterUnderline({
  children,
  className,
  transition = { duration: 0.25, ease: "easeInOut" },
  underlineHeightRatio = 0.1,
  underlinePaddingRatio = 0.01,
}: UnderlineProps) {
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const update = () => {
      if (!textRef.current) return;
      const fontSize = parseFloat(getComputedStyle(textRef.current).fontSize);
      textRef.current.style.setProperty("--underline-height", `${fontSize * underlineHeightRatio}px`);
      textRef.current.style.setProperty("--underline-padding", `${fontSize * underlinePaddingRatio}px`);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [underlineHeightRatio, underlinePaddingRatio]);

  return (
    <motion.span ref={textRef} className={cn("relative inline-block cursor-pointer", className)} initial="hidden" whileHover="visible" whileFocus="visible">
      <span>{children}</span>
      <motion.span
        className="absolute left-1/2 block -translate-x-1/2 bg-current"
        style={{ height: "var(--underline-height)", bottom: "calc(-1 * var(--underline-padding))" }}
        variants={{ hidden: { width: 0, originX: 0.5 }, visible: { width: "100%", transition } }}
        aria-hidden="true"
      />
    </motion.span>
  );
}
