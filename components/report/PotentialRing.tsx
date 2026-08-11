"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "@/components/dashboard/CountUp";
import { BRAND } from "@/lib/theme";

/**
 * The potential figure, as an arc.
 *
 * A ring rather than a second big numeral: the page already has one hero
 * number, and two numerals at the same weight would read as two headline
 * scores with no way to tell which one is yours.
 *
 * FLUID, NOT FIXED. It used to take a `size` in pixels, which meant the
 * score panel could only be two columns above a breakpoint — at 320px a
 * 126px ring left the headline 125px of column to live in. Driving it from
 * a viewBox lets the ring take whatever half the panel is, so the reference's
 * side-by-side layout holds at every width instead of collapsing on the
 * narrow phones this product is mostly read on.
 */
export function PotentialRing({
  value,
  label,
  className,
}: {
  /** 0–10. */
  value: number;
  label: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const r = 42;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, value / 10));

  return (
    <div className={`relative aspect-square w-full ${className ?? ""}`}>
      {/* The one glow on this panel, sized to the ring's inside so the bloom
          comes off the arc rather than out of the corners of the tile. */}
      <div
        aria-hidden
        className="absolute inset-[14%] rounded-full blur-2xl"
        style={{ background: `${BRAND.accent}2b` }}
      />

      <svg viewBox="0 0 100 100" className="relative h-full w-full -rotate-90">
        <defs>
          <linearGradient id="potentialArc" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={BRAND.accentPress} />
            <stop offset="100%" stopColor={BRAND.accentBright} />
          </linearGradient>
        </defs>

        <circle cx="50" cy="50" r={r} fill="none" stroke={BRAND.track} strokeWidth="6" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#potentialArc)"
          strokeWidth="6"
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
          className="text-[clamp(1.75rem,9vw,2.5rem)] font-semibold leading-none tracking-[-0.03em] text-[var(--color-accent)]"
        />
        <span className="mt-1 text-[11px] font-medium text-[var(--color-ink-tertiary)]">
          {label}
        </span>
      </div>
    </div>
  );
}
