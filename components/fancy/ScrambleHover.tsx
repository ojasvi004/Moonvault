"use client";
// Adapted from fancy components "Scramble Hover" (MIT, see LICENSE.md).
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "./cn";

interface ScrambleHoverProps {
  text: string;
  scrambleSpeed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: "start" | "end" | "center";
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  scrambledClassName?: string;
}

export default function ScrambleHover({
  text,
  scrambleSpeed = 50,
  maxIterations = 10,
  useOriginalCharsOnly = false,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+",
  className,
  scrambledClassName,
  sequential = false,
  revealDirection = "start",
}: ScrambleHoverProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrambling, setIsScrambling] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const revealedRef = useRef(new Set<number>());

  useEffect(() => {
    const revealedIdx = revealedRef.current;
    if (!isHovering) {
      revealedIdx.clear();
      return;
    }
    let iteration = 0;
    const available = useOriginalCharsOnly ? Array.from(new Set(text.split(""))).filter((c) => c !== " ") : characters.split("");

    const nextIndex = () => {
      const n = text.length;
      if (revealDirection === "end") return n - 1 - revealedIdx.size;
      if (revealDirection === "center") {
        const middle = Math.floor(n / 2);
        const offset = Math.floor(revealedIdx.size / 2);
        const i = revealedIdx.size % 2 === 0 ? middle + offset : middle - offset - 1;
        if (i >= 0 && i < n && !revealedIdx.has(i)) return i;
        for (let k = 0; k < n; k++) if (!revealedIdx.has(k)) return k;
        return 0;
      }
      return revealedIdx.size;
    };

    const shuffle = () => {
      if (useOriginalCharsOnly) {
        const pool = text.split("").filter((c, i) => c !== " " && !revealedIdx.has(i));
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        let p = 0;
        return text
          .split("")
          .map((c, i) => (c === " " ? " " : revealedIdx.has(i) ? c : pool[p++]))
          .join("");
      }
      return text
        .split("")
        .map((c, i) => (c === " " ? " " : revealedIdx.has(i) ? c : available[Math.floor(Math.random() * available.length)]))
        .join("");
    };

    const start = setTimeout(() => setIsScrambling(true), 0);
    const interval = setInterval(() => {
      if (sequential) {
        if (revealedIdx.size < text.length) {
          revealedIdx.add(nextIndex());
          setRevealed(new Set(revealedIdx));
          setDisplayText(shuffle());
        } else {
          clearInterval(interval);
          setIsScrambling(false);
        }
      } else {
        setDisplayText(shuffle());
        iteration++;
        if (iteration >= maxIterations) {
          clearInterval(interval);
          setIsScrambling(false);
          setDisplayText(text);
        }
      }
    }, scrambleSpeed);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [isHovering, text, characters, scrambleSpeed, useOriginalCharsOnly, sequential, revealDirection, maxIterations]);

  const shown = isHovering ? displayText : text;

  return (
    <motion.span
      onHoverStart={() => setIsHovering(true)}
      onHoverEnd={() => {
        setIsHovering(false);
        setIsScrambling(false);
        setRevealed(new Set());
        setDisplayText(text);
      }}
      className={cn("inline-block whitespace-pre-wrap", className)}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {shown.split("").map((char, index) => (
          <span key={index} className={revealed.has(index) || !isScrambling || !isHovering ? undefined : scrambledClassName}>
            {char}
          </span>
        ))}
      </span>
    </motion.span>
  );
}
