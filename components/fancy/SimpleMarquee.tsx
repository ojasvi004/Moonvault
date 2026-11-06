"use client";
// Adapted from fancy components "Simple Marquee" (MIT, see LICENSE.md).
// Kept: direction, base velocity, slow-down on hover, scroll-velocity boost, drag.
import { useRef, type PointerEvent, type ReactNode } from "react";
import { motion, useAnimationFrame, useMotionValue, useScroll, useSpring, useTransform, useVelocity, type SpringOptions } from "motion/react";
import { cn } from "./cn";

const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

interface SimpleMarqueeProps {
  children: ReactNode;
  className?: string;
  direction?: "left" | "right" | "up" | "down";
  baseVelocity?: number;
  slowdownOnHover?: boolean;
  slowDownFactor?: number;
  slowDownSpringConfig?: SpringOptions;
  useScrollVelocity?: boolean;
  scrollAwareDirection?: boolean;
  scrollSpringConfig?: SpringOptions;
  repeat?: number;
  draggable?: boolean;
  dragSensitivity?: number;
  dragVelocityDecay?: number;
  grabCursor?: boolean;
}

export default function SimpleMarquee({
  children,
  className,
  direction = "right",
  baseVelocity = 5,
  slowdownOnHover = false,
  slowDownFactor = 0.3,
  slowDownSpringConfig = { damping: 50, stiffness: 400 },
  useScrollVelocity = false,
  scrollAwareDirection = false,
  scrollSpringConfig = { damping: 50, stiffness: 400 },
  repeat = 3,
  draggable = false,
  dragSensitivity = 0.2,
  dragVelocityDecay = 0.96,
  grabCursor = false,
}: SimpleMarqueeProps) {
  const baseX = useMotionValue(0);
  const baseY = useMotionValue(0);
  const { scrollY } = useScroll();
  const smoothVelocity = useSpring(useVelocity(scrollY), scrollSpringConfig);
  const hoverFactor = useMotionValue(1);
  const defaultVelocity = useMotionValue(1);
  const smoothHover = useSpring(hoverFactor, slowDownSpringConfig);
  const velocityFactor = useTransform(useScrollVelocity ? smoothVelocity : defaultVelocity, [0, 1000], [0, 5], { clamp: false });

  const isHorizontal = direction === "left" || direction === "right";
  const actualBase = direction === "left" || direction === "up" ? -baseVelocity : baseVelocity;
  const isHovered = useRef(false);
  const isDragging = useRef(false);
  const dragVelocity = useRef(0);
  const directionFactor = useRef(1);
  const last = useRef({ x: 0, y: 0 });

  const x = useTransform(baseX, (v) => `${wrap(0, -100, v)}%`);
  const y = useTransform(baseY, (v) => `${wrap(0, -100, v)}%`);

  useAnimationFrame((_, delta) => {
    const target = isHorizontal ? baseX : baseY;
    if (isDragging.current && draggable) {
      target.set(target.get() + dragVelocity.current);
      dragVelocity.current *= 0.9;
      if (Math.abs(dragVelocity.current) < 0.01) dragVelocity.current = 0;
      return;
    }
    hoverFactor.set(isHovered.current && slowdownOnHover ? slowDownFactor : 1);
    let moveBy = directionFactor.current * actualBase * (delta / 1000) * smoothHover.get();
    if (scrollAwareDirection) {
      if (velocityFactor.get() < 0) directionFactor.current = -1;
      else if (velocityFactor.get() > 0) directionFactor.current = 1;
    }
    moveBy += directionFactor.current * moveBy * velocityFactor.get();
    if (draggable) {
      moveBy += dragVelocity.current;
      dragVelocity.current = Math.abs(dragVelocity.current) > 0.01 ? dragVelocity.current * dragVelocityDecay : 0;
    }
    target.set(target.get() + moveBy);
  });

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (grabCursor) e.currentTarget.style.cursor = "grabbing";
    isDragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    dragVelocity.current = 0;
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggable || !isDragging.current) return;
    const d = isHorizontal ? e.clientX - last.current.x : e.clientY - last.current.y;
    dragVelocity.current = d * dragSensitivity;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggable) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (grabCursor) e.currentTarget.style.cursor = "";
    isDragging.current = false;
  };

  return (
    <motion.div
      className={cn("flex", isHorizontal ? "flex-row" : "flex-col", draggable && "touch-pan-y", className)}
      onHoverStart={() => (isHovered.current = true)}
      onHoverEnd={() => (isHovered.current = false)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {Array.from({ length: repeat }, (_, i) => (
        <motion.div key={i} className={cn("shrink-0", isHorizontal && "flex", draggable && grabCursor && "cursor-grab")} style={isHorizontal ? { x } : { y }} aria-hidden={i > 0}>
          {children}
        </motion.div>
      ))}
    </motion.div>
  );
}
