"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Info } from "lucide-react";
import { CountUp } from "./CountUp";
import { percentileFor, topPercentFor } from "@/lib/percentile";
import { fill, useT } from "@/lib/i18n";

/**
 * Prominent percentile, shown before payment.
 *
 * The headline figure is real: the share of a modelled comparison
 * distribution scoring lower (see lib/percentile.ts). It deliberately does
 * NOT claim an attractiveness ranking — the score measures conformity to
 * published reference proportions and has never been validated against
 * attractiveness ratings, so "top N% most attractive" would be a fabricated
 * claim about the person. The info toggle states what the number is.
 */
export function PercentileBadge({ overall }: { overall: number }) {
  const t = useT();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const top = topPercentFor(overall);
  const below = percentileFor(overall);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.07] px-4 py-3"
    >
      {/* Slow sheen — draws the eye without shouting */}
      {reduce ? null : (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/[0.07]"
          animate={{ left: ["-33%", "133%"] }}
          transition={{ duration: 2.6, delay: 1.4, repeat: Infinity, repeatDelay: 6 }}
        />
      )}

      <div className="relative flex items-center gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          📈
        </span>
        <div className="min-w-0 flex-1">
          {/* Split the template on {n} so the number can animate in place. */}
          <p className="text-lg font-semibold leading-none tracking-tight text-accent">
            {(() => {
              const [before, after = ""] = t.results.percentileTop.split("{n}");
              return (
                <>
                  {before}
                  <CountUp value={top} duration={1400} delay={900} />
                  {after}
                </>
              );
            })()}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-400">
            {fill(t.results.percentileCaption, { below })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Info"
          className="shrink-0 self-start rounded-full p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden text-[10px] leading-relaxed text-zinc-500"
          >
            <span className="mt-2 block">{t.results.percentileWhat}</span>
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
