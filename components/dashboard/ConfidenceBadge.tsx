"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { CountUp } from "./CountUp";
import { DEFAULT_WEIGHTS } from "@/lib/analysis/weights";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/**
 * Capture quality, shown next to the score.
 *
 * Kept visually distinct from the score itself, because they mean different
 * things: the score is about the face, this is about the photograph. When
 * confidence is low the honest message is "this reading is shaky, retake
 * it" — not a quietly worse number that the user would read as a verdict.
 */
export function ConfidenceBadge({
  confidence,
  issues,
}: {
  confidence: number;
  issues: string[];
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const pct = Math.round(confidence * 100);
  const low = confidence < DEFAULT_WEIGHTS.confidence.warnBelow;

  const named = issues
    .map((k) => (t.quality.issues as Record<string, string>)[k])
    .filter(Boolean);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.85 }}
      className={cn(
        "rounded-xl border px-3 py-2",
        low
          ? "border-amber-500/30 bg-amber-500/[0.07]"
          : "border-white/[0.08] bg-white/[0.02]",
      )}
    >
      <div className="flex items-center gap-2">
        {low ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        ) : null}
        <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          {t.quality.label}
        </span>
        <span
          className={cn(
            "ml-auto text-[13px] font-semibold tabular-nums",
            low ? "text-amber-300" : "text-zinc-200",
          )}
        >
          <CountUp value={pct} delay={950} />%
        </span>
      </div>

      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className={cn("h-full rounded-full", low ? "bg-amber-400" : "bg-accent")}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, delay: 0.95, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {named.length > 0 ? (
        <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">
          {named.join(" · ")}
        </p>
      ) : null}

      {low ? (
        <p className="mt-1.5 text-[10px] leading-relaxed text-amber-300/85">
          {t.quality.low}
        </p>
      ) : null}
    </motion.div>
  );
}
