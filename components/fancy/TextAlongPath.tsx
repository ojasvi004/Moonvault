"use client";

export function TextAlongPath({
  text,
  pathId = "circlePath",
  className = "",
}: {
  text: string;
  pathId?: string;
  className?: string;
}) {
  return (
    <div className={`pointer-events-none select-none ${className}`}>
      <svg viewBox="0 0 200 200" className="w-full h-full animate-spin-slow">
        <path
          id={pathId}
          d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0"
          fill="none"
        />
        <text className="text-[10px] font-mono uppercase tracking-[0.22em] fill-current opacity-70">
          <textPath href={`#${pathId}`} startOffset="0%">
            {text}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
