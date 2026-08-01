"use client";

import { motion } from "framer-motion";

/**
 * The hero figure. Exactly one per view, ≥48px, in the body sans.
 * Proportional figures — tabular-nums would make a value like "7.1" read
 * loose at display size.
 */
export function ScoreRing({
  score,
  color = "#95BF47",
  size = 240,
}: {
  score: number; // 0–10
  color?: string;
  size?: number;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2 - 10;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, score / 10));

  // Tick marks around the dial — recessive, hairline.
  const ticks = Array.from({ length: 40 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 40 - Math.PI / 2;
    const inner = r + stroke / 2 + 5;
    const outer = inner + (i % 5 === 0 ? 7 : 3.5);
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
    <div className="relative" style={{ width: size, height: size }}>
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute inset-6 rounded-full blur-2xl"
        style={{ background: `${color}22` }}
      />

      <svg width={size} height={size} className="relative">
        <defs>
          <linearGradient id="scoreRing" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.lit ? color : "rgba(255,255,255,0.13)"}
            strokeOpacity={t.lit ? (t.major ? 0.85 : 0.5) : 1}
            strokeWidth={1}
            strokeLinecap="round"
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
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - c * ratio }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-[64px] font-semibold leading-none tracking-tight text-zinc-50"
        >
          {score.toFixed(1)}
        </motion.span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
          out of 10
        </span>
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
  const size = 62;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#95BF47"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * value) / 100 }}
            transition={{ duration: 1.1, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-lg"
          aria-hidden
        >
          {emoji}
        </span>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold leading-none text-zinc-100">
          {value}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-zinc-500">
          {label}
        </p>
      </div>
    </motion.div>
  );
}
