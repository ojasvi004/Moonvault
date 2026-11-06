"use client";
import { useEffect, useState } from "react";

export function BasicNumberTicker({
  value,
  duration = 1500,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCurrent(Math.floor(progress * value));
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCurrent(value);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return (
    <span className={`font-mono font-bold tracking-tight ${className}`}>
      {prefix}
      {current.toLocaleString()}
      {suffix}
    </span>
  );
}
