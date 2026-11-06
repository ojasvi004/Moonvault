"use client";

export function AnimatedGradientSvg({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`pointer-events-none select-none overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 1000 600"
        className="w-full h-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="peachPastel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd8c2">
              <animate
                attributeName="stop-color"
                values="#ffd8c2;#fed2bb;#ffe2d1;#ffd8c2"
                dur="8s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor="#fcd3de">
              <animate
                attributeName="stop-color"
                values="#fcd3de;#fde4e1;#fed7cc;#fcd3de"
                dur="8s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#fdebd0">
              <animate
                attributeName="stop-color"
                values="#fdebd0;#ffe1c6;#fce2e8;#fdebd0"
                dur="8s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
        <rect width="1000" height="600" fill="url(#peachPastel)" />
        <circle cx="280" cy="180" r="220" fill="#fbcfe8" opacity="0.45">
          <animate
            attributeName="cx"
            values="280;420;280"
            dur="10s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="720" cy="320" r="240" fill="#fed7aa" opacity="0.45">
          <animate
            attributeName="cy"
            values="320;180;320"
            dur="12s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </div>
  );
}
