"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "./CountUp";
import { useT } from "@/lib/i18n";
import { BRAND } from "@/lib/theme";

/**
 * The hero figure. Exactly one per view, in the body sans.
 * Proportional figures — tabular-nums would make "7.1" read loose at
 * display size.
 */
export function ScoreRing({
  score,
  color = BRAND.accent,
  size = 168,
}: {
  score: number; // 0–10
  color?: string;
  size?: number;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const stroke = 9;
  const r = (size - stroke) / 2 - 9;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, score / 10));

  const ticks = Array.from({ length: 40 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 40 - Math.PI / 2;
    const inner = r + stroke / 2 + 4;
    const outer = inner + (i % 5 === 0 ? 6 : 3);
    return {
      x1: size / 2 + Math.cos(a) * inner,
      y1: size / 2 + Math.sin(a) * inner,
      x2: size / 2 + Math.cos(a) * outer,
      y2: size / 2 + Math.sin(a) * outer,
      major: i % 5 === 0,
      lit: i / 40 <= ratio,
    };
  });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <motion.div
        aria-hidden
        className="absolute inset-5 rounded-full blur-2xl"
        style={{ background: `${color}26` }}
        initial={reduce ? false : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />

      <svg width={size} height={size} className="relative">
        <defs>
          <linearGradient id="scoreRing" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>

        {ticks.map((tk, i) => (
          <motion.line
            key={i}
            x1={tk.x1}
            y1={tk.y1}
            x2={tk.x2}
            y2={tk.y2}
            stroke={tk.lit ? color : "rgba(255,255,255,0.13)"}
            strokeOpacity={tk.lit ? (tk.major ? 0.85 : 0.5) : 1}
            strokeWidth={1}
            strokeLinecap="round"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: reduce ? 0 : 0.3 + i * 0.012 }}
          />
        ))}

        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#scoreRing)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={reduce ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - c * ratio }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Display size, so tracking goes NEGATIVE — San Francisco tightens
            above 28pt and a hero figure set at default tracking reads loose.
            Proportional figures, not tabular: tabular-nums pads the "7" in
            "7.1" to the width of a "0" and opens a visible gap at this size. */}
        <CountUp
          value={score}
          decimals={1}
          duration={1500}
          className="text-[46px] font-semibold leading-none tracking-[-0.03em] text-[var(--color-ink)]"
        />
        <span className="t-eyebrow mt-1.5">{t.results.outOf}</span>
      </div>
    </div>
  );
}

/** Compact category dial — a stat tile, not a second hero. */
export function MiniRing({
  emoji,
  label,
  value,
  delay = 0,
}: {
  emoji: string;
  label: string;
  value: number; // 0–100
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const size = 52;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex flex-col items-center gap-1.5"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
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
            stroke={BRAND.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={reduce ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * value) / 100 }}
            transition={{ duration: 1, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[15px]"
          aria-hidden
        >
          {emoji}
        </span>
      </div>
      <p className="text-[13px] font-semibold leading-none text-[var(--color-ink)]">
        <CountUp value={value} delay={delay * 1000} />
      </p>
      <p className="text-[9px] uppercase tracking-[0.08em] text-[var(--color-ink-tertiary)]">
        {label}
      </p>
    </motion.div>
  );
}
