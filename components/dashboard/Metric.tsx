"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/** Small radial gauge used across the biometrics grid. */
export function Gauge({
  value,
  size = 88,
  stroke = 7,
  display,
}: {
  value: number;
  size?: number;
  stroke?: number;
  display?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
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
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono-terminal text-lg font-semibold tabular-nums">
          {display ?? value}
        </span>
      </div>
    </div>
  );
}

/** Biometric readout card: gauge + label + raw measurement + interpretation. */
export function BiometricCard({
  label,
  value,
  display,
  measurement,
  note,
  icon,
  className,
}: {
  label: string;
  value: number;
  display?: string;
  measurement: string;
  note: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass flex items-start gap-5 rounded-3xl p-6",
        className,
      )}
    >
      <Gauge value={value} display={display} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          {icon}
          {label}
        </div>
        <p className="font-mono-terminal mt-2 text-sm text-accent">
          {measurement}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{note}</p>
      </div>
    </div>
  );
}
