"use client";
// Adapted from fancy components "Text Highlighter" (MIT, see LICENSE.md).
import { useRef, useState, type ElementType, type ReactNode } from "react";
import { motion, useInView, type Transition, type UseInViewOptions } from "motion/react";
import { cn } from "./cn";

type HighlightDirection = "ltr" | "rtl" | "ttb" | "btt";

type TextHighlighterProps = {
  children: ReactNode;
  as?: ElementType;
  triggerType?: "hover" | "inView" | "auto";
  transition?: Transition;
  useInViewOptions?: UseInViewOptions;
  className?: string;
  highlightColor?: string;
  direction?: HighlightDirection;
};

const SIZE: Record<HighlightDirection, [string, string]> = {
  ltr: ["0% 100%", "100% 100%"],
  rtl: ["0% 100%", "100% 100%"],
  ttb: ["100% 0%", "100% 100%"],
  btt: ["100% 0%", "100% 100%"],
};
const POSITION: Record<HighlightDirection, string> = { ltr: "0% 0%", rtl: "100% 0%", ttb: "0% 0%", btt: "0% 100%" };

export default function TextHighlighter({
  children,
  as = "span",
  triggerType = "inView",
  transition = { type: "spring", duration: 1, delay: 0, bounce: 0 },
  useInViewOptions = { once: true, initial: false, amount: 0.1 },
  className,
  highlightColor = "hsl(25, 90%, 80%)",
  direction = "ltr",
}: TextHighlighterProps) {
  const ref = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const inView = useInView(ref, useInViewOptions);
  const on = triggerType === "hover" ? hovered : triggerType === "inView" ? inView : true;
  const [from, to] = SIZE[direction];
  const Tag = as;

  return (
    <Tag ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <motion.span
        className={cn("inline", className)}
        style={{
          backgroundImage: `linear-gradient(${highlightColor}, ${highlightColor})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: POSITION[direction],
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
        initial={{ backgroundSize: from }}
        animate={{ backgroundSize: on ? to : from }}
        transition={transition}
      >
        {children}
      </motion.span>
    </Tag>
  );
}
