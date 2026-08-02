"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Info } from "lucide-react";
import { CountUp } from "./CountUp";
import { percentileFor, topPercentFor } from "@/lib/percentile";
import { fill, useT } from "@/lib/i18n";

/** Split a template on {token} so the number can animate in place. */
function Animated({
  template,
  token,
  value,
  delay,
  className,
}: {
  template: string;
  token: string;
  value: number;
  delay: number;
  className?: string;
}) {
  const [before, after = ""] = template.split(`{${token}}`);
  return (
    <span className={className}>
      {before}
      <CountUp value={value} duration={1300} delay={delay} />
      {after}
    </span>
  );
}

/**
 * Prominent percentile, shown before payment.
 *
 * The headline is the plain percentile, which is meaningful at every score.
 * "Top N%" is a secondary badge that only appears when the result really is
 * in the upper half — the previous version always rendered 100 minus the
 * percentile, so a below-average scan announced "Top 100%", which means
 * nothing and reads as praise.
 *
 * It deliberately does not claim an attractiveness ranking: the score
 * measures conformity to published reference proportions and has never been
 * validated against attractiveness ratings.
 */
export function PercentileBadge({ overall }: { overall: number }) {
  const t = useT();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const below = percentileFor(overall);
  const top = topPercentFor(overall);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.07] px-4 py-3"
    >
      {reduce ? null : (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/[0.07]"
          animate={{ left: ["-33%", "133%"] }}
          transition={{ duration: 2.6, delay: 1.4, repeat: Infinity, repeatDelay: 6 }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          📈
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Animated
              template={t.results.percentileBetter}
              token="p"
              value={below}
              delay={850}
              className="text-lg font-semibold leading-none tracking-tight text-accent"
            />
            {top !== null ? (
              <Animated
                template={t.results.percentileTop}
                token="n"
                value={top}
                delay={850}
                className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent"
              />
            ) : null}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-zinc-400">
            {t.results.percentileCaption}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Info"
          className="shrink-0 rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden"
          >
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
              {t.results.percentileWhat}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
