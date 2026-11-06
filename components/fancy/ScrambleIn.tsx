"use client";
// Adapted from fancy components "Scramble In" (MIT, see LICENSE.md).
// Added: optional start when scrolled into view.
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

interface ScrambleInProps {
  text: string;
  scrambleSpeed?: number;
  scrambledLetterCount?: number;
  characters?: string;
  className?: string;
  scrambledClassName?: string;
  /** Start when visible (default) or immediately on mount. */
  trigger?: "inView" | "mount";
  delay?: number;
}

export default function ScrambleIn({
  text,
  scrambleSpeed = 40,
  scrambledLetterCount = 3,
  characters = "abcdefghijklmnopqrstuvwxyz!@#$%^&*()_+",
  className = "",
  scrambledClassName = "",
  trigger = "inView",
  delay = 0,
}: ScrambleInProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const go = trigger === "mount" || inView;
  const [revealed, setRevealed] = useState(0);
  const [scrambled, setScrambled] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!go) return;
    let visible = 0;
    let offset = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        if (visible < text.length) visible++;
        else if (offset < scrambledLetterCount) offset++;
        else {
          clearInterval(interval);
          setScrambled("");
          setDone(true);
          return;
        }
        const count = Math.min(Math.max(0, text.length - visible), scrambledLetterCount);
        setRevealed(visible);
        setScrambled(Array.from({ length: count }, () => characters[Math.floor(Math.random() * characters.length)]).join(""));
      }, scrambleSpeed);
    }, delay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [go, text, scrambledLetterCount, characters, scrambleSpeed, delay]);

  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <span className="inline-block whitespace-pre-wrap" aria-hidden="true">
        {done ? (
          <span className={className}>{text}</span>
        ) : (
          <>
            <span className={className}>{text.slice(0, revealed)}</span>
            <span className={scrambledClassName}>{scrambled}</span>
            {/* Reserve the final width so layout does not jump while scrambling. */}
            <span className="invisible">{text.slice(revealed + scrambled.length)}</span>
          </>
        )}
      </span>
    </span>
  );
}
