"use client";
// Adapted from fancy components "Text Along Path" (MIT, see LICENSE.md).
import { useEffect, useId, useRef, type RefObject } from "react";
import { useScroll, useTransform, type UseScrollOptions } from "motion/react";

interface AnimatedPathTextProps {
  path: string;
  pathClassName?: string;
  preserveAspectRatio?: string;
  showPath?: boolean;
  width?: string | number;
  height?: string | number;
  viewBox?: string;
  svgClassName?: string;
  text: string;
  textClassName?: string;
  textAnchor?: "start" | "middle" | "end";
  animationType?: "auto" | "scroll";
  duration?: number;
  repeatCount?: number | "indefinite";
  /** Element whose scroll position drives the "scroll" animation (defaults to the svg itself in the window). */
  scrollTarget?: RefObject<HTMLElement | null>;
  scrollOffset?: UseScrollOptions["offset"];
  scrollTransformValues?: [number, number];
}

export default function TextAlongPath({
  path,
  pathClassName,
  preserveAspectRatio = "xMidYMid meet",
  showPath = false,
  width = "100%",
  height = "100%",
  viewBox = "0 0 100 100",
  svgClassName,
  text,
  textClassName,
  textAnchor = "start",
  animationType = "auto",
  duration = 4,
  repeatCount = "indefinite",
  scrollTarget,
  scrollOffset = ["start end", "end start"],
  scrollTransformValues = [0, 100],
}: AnimatedPathTextProps) {
  const id = `path-${useId().replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const textPathRef = useRef<SVGTextPathElement>(null);
  const { scrollYProgress } = useScroll({ target: (scrollTarget ?? svgRef) as RefObject<HTMLElement | null>, offset: scrollOffset });
  const t = useTransform(scrollYProgress, [0, 1], scrollTransformValues);

  useEffect(() => {
    if (animationType !== "scroll") return;
    return t.on("change", (v) => textPathRef.current?.setAttribute("startOffset", `${v}%`));
  }, [t, animationType]);

  const anim = { from: "0%", to: "100%", begin: "0s", dur: `${duration}s`, repeatCount };

  return (
    <svg ref={svgRef} className={svgClassName} xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={viewBox} preserveAspectRatio={preserveAspectRatio} aria-hidden>
      <path id={id} className={pathClassName} d={path} stroke={showPath ? "currentColor" : "none"} fill="none" />
      <text textAnchor={textAnchor} fill="currentColor">
        <textPath ref={textPathRef} className={textClassName} href={`#${id}`} startOffset={animationType === "scroll" ? `${scrollTransformValues[0]}%` : "0%"}>
          {animationType === "auto" && <animate attributeName="startOffset" {...anim} />}
          {text}
        </textPath>
      </text>
      {animationType === "auto" && (
        <text textAnchor={textAnchor} fill="currentColor">
          <textPath className={textClassName} href={`#${id}`} startOffset="-100%">
            <animate attributeName="startOffset" {...anim} from="-100%" to="0%" />
            {text}
          </textPath>
        </text>
      )}
    </svg>
  );
}
