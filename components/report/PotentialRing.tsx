"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "@/components/dashboard/CountUp";
import { BRAND } from "@/lib/theme";

/**
 * The potential figure, as an arc.
 *
 * A ring rather than a second big numeral, because the page already has one
 * hero number and two numerals at the same weight would read as two headline
 * scores with no way to tell which is the result. An arc says "of a maximum"
 * on sight, which is exactly what a potential is.
 *
 * The gradient runs along the stroke so the lit part has a direction — a flat
 * fill reads as a chart, a graded one reads as a readout.
 */
export function PotentialRing({
  value,
  size = 126,
  label,
}: {
  /** 0–10. */
  value: number;
  size?: number;
  label: string;
}) {
  const reduce = useReducedMotion();
  const stroke = 8;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, value / 10));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* The one glow on this panel. Sized to the ring's inside so the bloom
          comes off the arc rather than out of the tile's corners. */}
      <div
        aria-hidden
        className="absolute inset-4 rounded-full blur-2xl"
        style={{ background: `${BRAND.accent}24` }}
      />

      <svg width={size} height={size} className="relative -rotate-90">
        <defs>
          <linearGradient id="potentialArc" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={BRAND.accentPress} />
            <stop offset="100%" stopColor={BRAND.accentBright} />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={BRAND.track}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#potentialArc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - c * ratio }}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp
          value={value}
          decimals={1}
          duration={1400}
          delay={300}
          className="text-[34px] font-semibold leading-none tracking-[-0.03em] text-[var(--color-accent)]"
        />
        <span className="mt-1.5 text-[11px] font-medium text-[var(--color-ink-tertiary)]">
          {label}
        </span>
      </div>
    </div>
  );
}
