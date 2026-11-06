"use client";
import { useEffect, useState } from "react";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#";

export function ScrambleIn({
  text,
  speed = 35,
  className = "",
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplay(
        text
          .split("")
          .map((char, index) => {
            if (index < iteration) return text[index];
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }
      iteration += 1 / 2;
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span className={className}>{display}</span>;
}
