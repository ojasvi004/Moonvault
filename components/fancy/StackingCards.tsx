"use client";
// Adapted from fancy components "Stacking Cards" (author: Khoa Phan, MIT, see LICENSE.md).
import { createContext, useContext, useRef, type HTMLAttributes, type PropsWithChildren } from "react";
import { motion, useScroll, useTransform, type MotionValue, type UseScrollOptions } from "motion/react";
import { cn } from "./cn";

interface StackingCardsProps extends PropsWithChildren, HTMLAttributes<HTMLDivElement> {
  scrollOptions?: Omit<UseScrollOptions, "target">;
  scaleMultiplier?: number;
  totalCards: number;
}

interface StackingCardItemProps extends HTMLAttributes<HTMLDivElement>, PropsWithChildren {
  index: number;
  topPosition?: string;
}

const StackingCardsContext = createContext<{ progress: MotionValue<number>; scaleMultiplier?: number; totalCards?: number } | null>(null);

export default function StackingCards({ children, className, scrollOptions, scaleMultiplier, totalCards, ...props }: StackingCardsProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ offset: ["start start", "end end"], ...scrollOptions, target: targetRef });
  return (
    <StackingCardsContext.Provider value={{ progress: scrollYProgress, scaleMultiplier, totalCards }}>
      <div className={cn(className)} ref={targetRef} {...props}>
        {children}
      </div>
    </StackingCardsContext.Provider>
  );
}

export function StackingCardItem({ index, topPosition, className, children, ...props }: StackingCardItemProps) {
  const ctx = useContext(StackingCardsContext);
  if (!ctx) throw new Error("StackingCardItem must be used within StackingCards");
  const { progress, scaleMultiplier, totalCards = 0 } = ctx;
  const scaleTo = 1 - (totalCards - index) * (scaleMultiplier ?? 0.03);
  const scale = useTransform(progress, [index * (1 / totalCards), 1], [1, scaleTo]);
  const top = topPosition ?? `${5 + index * 3}%`;
  return (
    <div className={cn("sticky top-0 h-full", className)} {...props}>
      <motion.div className="relative h-full origin-top" style={{ top, scale }}>
        {children}
      </motion.div>
    </div>
  );
}
