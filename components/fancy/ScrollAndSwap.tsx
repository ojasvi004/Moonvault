"use client";
import { useEffect, useState } from "react";

export function ScrollAndSwap({
  firstText,
  secondText,
  threshold = 150,
  className = "",
}: {
  firstText: string;
  secondText: string;
  threshold?: number;
  className?: string;
}) {
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setSwapped(window.scrollY > threshold);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return (
    <span className={`inline-block transition-all duration-300 font-display ${className}`}>
      {swapped ? secondText : firstText}
    </span>
  );
}
