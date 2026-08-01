"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Animated number. Counts from 0 to `value` on mount.
 * Respects prefers-reduced-motion by jumping straight to the value.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 1200,
  delay = 0,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start - delay;
      if (elapsed < 0) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, elapsed / duration);
      // easeOutExpo — fast start, gentle settle
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplay(value * eased);
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, delay, reduce]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}
