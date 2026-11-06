"use client";
// Adapted from fancy components "Text Rotate" (MIT, see LICENSE.md).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, type ElementType } from "react";
import { AnimatePresence, motion, type AnimatePresenceProps, type MotionProps, type Transition } from "motion/react";
import { cn } from "./cn";

const splitIntoCharacters = (text: string): string[] => {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
};

type AnimState = MotionProps["initial"];

interface TextRotateProps {
  texts: string[];
  as?: ElementType;
  rotationInterval?: number;
  initial?: AnimState | AnimState[];
  animate?: MotionProps["animate"] | MotionProps["animate"][];
  exit?: MotionProps["exit"] | MotionProps["exit"][];
  animatePresenceMode?: AnimatePresenceProps["mode"];
  animatePresenceInitial?: boolean;
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | number;
  transition?: Transition;
  loop?: boolean;
  auto?: boolean;
  splitBy?: "words" | "characters" | "lines" | string;
  onNext?: (index: number) => void;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
}

export interface TextRotateRef {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

interface WordObject {
  characters: string[];
  needsSpace: boolean;
}

const TextRotate = forwardRef<TextRotateRef, TextRotateProps>(
  (
    {
      texts,
      as = "p",
      transition = { type: "spring", damping: 25, stiffness: 300 },
      initial = { y: "100%", opacity: 0 },
      animate = { y: 0, opacity: 1 },
      exit = { y: "-120%", opacity: 0 },
      animatePresenceMode = "wait",
      animatePresenceInitial = false,
      rotationInterval = 2000,
      staggerDuration = 0,
      staggerFrom = "first",
      loop = true,
      auto = true,
      splitBy = "characters",
      onNext,
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
    },
    ref,
  ) => {
    const [currentTextIndex, setCurrentTextIndex] = useState(0);

    const elements: WordObject[] = useMemo(() => {
      const currentText = texts[currentTextIndex];
      if (splitBy === "characters") {
        const words = currentText.split(" ");
        return words.map((word, i) => ({ characters: splitIntoCharacters(word), needsSpace: i !== words.length - 1 }));
      }
      const parts = splitBy === "words" ? currentText.split(" ") : splitBy === "lines" ? currentText.split("\n") : currentText.split(splitBy);
      return parts.map((el, i) => ({ characters: [el], needsSpace: i !== parts.length - 1 }));
    }, [texts, currentTextIndex, splitBy]);

    const totalChars = elements.reduce((sum, w) => sum + w.characters.length, 0);

    const getStaggerDelay = useCallback(
      (index: number, total: number) => {
        if (staggerFrom === "first") return index * staggerDuration;
        if (staggerFrom === "last") return (total - 1 - index) * staggerDuration;
        if (staggerFrom === "center") return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
        return Math.abs(staggerFrom - index) * staggerDuration;
      },
      [staggerFrom, staggerDuration],
    );

    const handleIndexChange = useCallback(
      (newIndex: number) => {
        setCurrentTextIndex(newIndex);
        onNext?.(newIndex);
      },
      [onNext],
    );

    const next = useCallback(() => {
      const nextIndex = currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
      if (nextIndex !== currentTextIndex) handleIndexChange(nextIndex);
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);

    const previous = useCallback(() => {
      const prevIndex = currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1;
      if (prevIndex !== currentTextIndex) handleIndexChange(prevIndex);
    }, [currentTextIndex, texts.length, loop, handleIndexChange]);

    const jumpTo = useCallback(
      (index: number) => {
        const validIndex = Math.max(0, Math.min(index, texts.length - 1));
        if (validIndex !== currentTextIndex) handleIndexChange(validIndex);
      },
      [texts.length, currentTextIndex, handleIndexChange],
    );

    const reset = useCallback(() => {
      if (currentTextIndex !== 0) handleIndexChange(0);
    }, [currentTextIndex, handleIndexChange]);

    const pick = <T,>(prop: T | T[], index: number): T => (Array.isArray(prop) ? prop[index % prop.length] : prop);

    useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }), [next, previous, jumpTo, reset]);

    useEffect(() => {
      if (!auto) return;
      const id = setInterval(next, rotationInterval);
      return () => clearInterval(id);
    }, [next, rotationInterval, auto]);

    const Tag = as;

    return (
      <Tag className={cn("flex flex-wrap whitespace-pre-wrap", mainClassName)}>
        <span className="sr-only">{texts[currentTextIndex]}</span>
        <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
          <motion.span key={currentTextIndex} className={cn("flex flex-wrap", splitBy === "lines" && "w-full flex-col")} aria-hidden layout>
            {elements.map((wordObj, wordIndex, array) => {
              const previousCharsCount = array.slice(0, wordIndex).reduce((sum, w) => sum + w.characters.length, 0);
              return (
                <span key={wordIndex} className={cn("inline-flex", splitLevelClassName)}>
                  {wordObj.characters.map((char, charIndex) => {
                    const totalIndex = previousCharsCount + charIndex;
                    return (
                      <span key={totalIndex} className={elementLevelClassName}>
                        <motion.span
                          initial={pick(initial, totalIndex)}
                          animate={pick(animate, totalIndex)}
                          exit={pick(exit, totalIndex)}
                          transition={{ ...transition, delay: getStaggerDelay(totalIndex, totalChars) }}
                          className="inline-block"
                        >
                          {char}
                        </motion.span>
                      </span>
                    );
                  })}
                  {wordObj.needsSpace && <span className="whitespace-pre"> </span>}
                </span>
              );
            })}
          </motion.span>
        </AnimatePresence>
      </Tag>
    );
  },
);

TextRotate.displayName = "TextRotate";
export default TextRotate;
