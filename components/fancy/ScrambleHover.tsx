"use client";
import { useState } from "react";

const GLYPHS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~0123456789";

export function ScrambleHover({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(text);

  function handleMouseEnter() {
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
    }, 30);
  }

  return (
    <span
      onMouseEnter={handleMouseEnter}
      className={`inline-block cursor-default select-none ${className}`}
    >
      {display}
    </span>
  );
}
