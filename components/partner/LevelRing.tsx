"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

// The level ring: one circle, the progress toward the next rung, the level
// number in the middle.
//
// WHY THE PROGRESS IS A PROP AND NOT COMPUTED HERE
// The ring draws what the server's `progress` block says. The thresholds live
// in the admin configuration and change; a ring that recomputed them from a
// customer count would eventually disagree with the sentence underneath it,
// and of the two the sentence is the one people read.

const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Count a number up on first paint, and again whenever it changes.
 *
 * Exported because the statistics quadrant wants the same behaviour and the
 * two would otherwise drift apart. Under `prefers-reduced-motion` the value
 * is simply set — no timer starts at all, rather than a fast animation.
 */
export function useCountUp(value: number, durationSeconds = 0.9): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  // The value the animation starts from: the last one displayed, so a number
  // that grows counts on from where the customer last saw it instead of
  // dropping back to zero.
  const from = useRef(0);

  useEffect(() => {
    if (reduce) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: durationSeconds,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setShown(v),
      onComplete: () => {
        from.current = value;
      },
    });
    return () => controls.stop();
  }, [value, durationSeconds, reduce]);

  return shown;
}

interface Props {
  level: number;
  label: string;
  percent: number;
  /** 0…1 toward the next rung. 1 when there is no higher rung. */
  progress: number;
  atTop: boolean;
  /** Formatted "x % per purchase" line under the label. */
  percentLine: string;
  levelWord: string;
}

export function LevelRing({ level, label, progress, atTop, percentLine, levelWord }: Props) {
  const reduce = useReducedMotion();
  const shownLevel = useCountUp(level, 0.7);

  // THE ONE MOMENT OF CELEBRATION, and it fires on a real event: the level
  // stored from the last visit is lower than the one the server just sent.
  // Kept in localStorage rather than in a flag from the API because it is a
  // property of "what this browser last showed you", not of the account —
  // and because a missing entry has to mean "nothing to celebrate", which is
  // what a first visit gets.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    const KEY = "facescan.partner.level";
    let seen = 0;
    try {
      seen = Number(window.localStorage.getItem(KEY) ?? "0");
    } catch {
      // Private mode or a blocked store: no celebration, no error either.
      return;
    }
    if (Number.isFinite(seen) && seen > 0 && level > seen) {
      setCelebrate(true);
      const timer = window.setTimeout(() => setCelebrate(false), 2200);
      try {
        window.localStorage.setItem(KEY, String(level));
      } catch {}
      return () => window.clearTimeout(timer);
    }
    try {
      window.localStorage.setItem(KEY, String(level));
    } catch {}
  }, [level]);

  const dash = CIRCUMFERENCE * Math.min(1, Math.max(0, progress));

  return (
    <div className="relative flex flex-col items-center">
      {/* The pulse. A ring that expands and fades once — no library, no
          confetti, and nothing at all when motion is reduced. */}
      {celebrate && !reduce ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute top-0 h-[150px] w-[150px] rounded-full border border-[var(--color-accent)]"
          initial={{ opacity: 0.75, scale: 0.86 }}
          animate={{ opacity: 0, scale: 1.45 }}
          transition={{ duration: 1.6, ease: "easeOut", repeat: 1 }}
        />
      ) : null}

      <div className="relative h-[150px] w-[150px]">
        <svg viewBox="0 0 150 150" className="h-full w-full -rotate-90">
          <circle
            cx="75"
            cy="75"
            r={RADIUS}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth="6"
          />
          <motion.circle
            cx="75"
            cy="75"
            r={RADIUS}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: reduce ? CIRCUMFERENCE - dash : CIRCUMFERENCE }}
            animate={{ strokeDashoffset: CIRCUMFERENCE - dash }}
            transition={reduce ? { duration: 0 } : { duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-tertiary)]">
            {levelWord}
          </span>
          <span
            className={cn(
              "tnum text-[46px] font-bold leading-none tracking-tight text-[var(--color-ink)]",
              atTop && "text-[var(--color-accent)]",
            )}
          >
            {Math.round(shownLevel)}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[17px] font-bold leading-none text-[var(--color-ink)]">{label}</p>
      <p className="mt-1.5 text-[12.5px] text-[var(--color-accent)]">{percentLine}</p>
    </div>
  );
}
