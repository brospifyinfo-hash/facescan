"use client";

import { motion } from "framer-motion";
import { BRAND } from "@/lib/theme";

export interface RadarAxis {
  label: string;
  value: number; // 0–100
}

/** Biometric radar. Pure SVG, no chart dependency. */
export function RadarChart({
  axes,
  size = 220,
  animate = true,
}: {
  axes: RadarAxis[];
  size?: number;
  animate?: boolean;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 42;
  const n = axes.length;

  const pointAt = (i: number, ratio: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r * ratio, cy + Math.sin(angle) * r * ratio];
  };

  const ringPath = (ratio: number) =>
    axes
      .map((_, i) => {
        const [x, y] = pointAt(i, ratio);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join("") + "Z";

  const shape =
    axes
      .map((a, i) => {
        const [x, y] = pointAt(i, a.value / 100);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join("") + "Z";

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Rings */}
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <path
          key={ratio}
          d={ringPath(ratio)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Spokes */}
      {axes.map((_, i) => {
        const [x, y] = pointAt(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        );
      })}

      {/* Value polygon */}
      <motion.path
        d={shape}
        fill="rgba(149,191,71,0.18)"
        stroke={BRAND.accent}
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ opacity: animate ? 0 : 1, scale: animate ? 0.6 : 1 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Vertices */}
      {axes.map((a, i) => {
        const [x, y] = pointAt(i, a.value / 100);
        return <circle key={a.label} cx={x} cy={y} r={3.5} fill={BRAND.accent} />;
      })}

      {/* Labels */}
      {axes.map((a, i) => {
        const [x, y] = pointAt(i, 1.24);
        return (
          <text
            key={a.label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-zinc-400"
            // SVG text takes its size from an attribute or an inline style,
            // never from a Tailwind class — which is why these five axis
            // labels were the last sub-11px text on the page after every
            // class-based size had been lifted onto the scale. 11px and the
            // eyebrow's tracking, matching .t-eyebrow exactly.
            style={{ fontSize: 11, letterSpacing: "0.09em" }}
          >
            {a.label.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}
