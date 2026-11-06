"use client";
import { useEffect, useState } from "react";

export function TextRotate({
  texts,
  interval = 2500,
  className = "",
}: {
  texts: string[];
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (texts.length <= 1) return;
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % texts.length);
        setFade(true);
      }, 250);
    }, interval);
    return () => clearInterval(timer);
  }, [texts, interval]);

  return (
    <span
      className={`inline-block transition-all duration-300 ${
        fade ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${className}`}
    >
      {texts[index]}
    </span>
  );
}
