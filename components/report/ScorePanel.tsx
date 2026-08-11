"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Info } from "lucide-react";
import { CountUp } from "@/components/dashboard/CountUp";
import { PotentialRing } from "./PotentialRing";
import { useT } from "@/lib/i18n";
import type { Band } from "@/lib/tiers";
import type { Potential } from "@/lib/potential";

/**
 * The payoff. One panel, two columns, a hairline between them — the
 * reference's layout, held at every width because the ring is fluid and the
 * headline is clamped rather than either being a fixed pixel size.
 *
 * The two figures are deliberately NOT the same weight. The headline is the
 * only numeral on the page at display scale; the potential is an arc, which
 * says "of a maximum" on sight. That is what stops a reader having to work
 * out which of two large green numbers is their result.
 *
 * The info buttons are not decoration. The percentile behind the headline
 * and the derivation behind the potential are both things a paying user is
 * entitled to ask about, and a tap is cheaper than a paragraph nobody reads.
 */
export function ScorePanel({
  score,
  band,
  bandLabel,
  bandBlurb,
  potential,
}: {
  score: number;
  band: Band;
  bandLabel: string;
  bandBlurb: string;
  /** Null when the scan carries no explainability payload to derive it from. */
  potential: Potential | null;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const [explain, setExplain] = useState<"score" | "potential" | null>(null);

  // A potential equal to the score is not a potential — nothing actionable is
  // out of reference. Showing "8.2 / 8.2" would invite a rounding artefact to
  // be read as headroom.
  const showPotential = potential !== null && potential.lift > 0;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08, ease: [0.32, 0.72, 0, 1] }}
      className="panel overflow-hidden p-[var(--pad-panel)]"
    >
      <div className={showPotential ? "grid grid-cols-2 gap-3" : "grid"}>
        {/* ---- Overall ---- */}
        <div className="min-w-0">
          <SectionLabel
            label={t.results.overall}
            open={explain === "score"}
            onToggle={() => setExplain((v) => (v === "score" ? null : "score"))}
          />

          <div className="mt-2 flex items-baseline gap-1">
            <CountUp
              value={score}
              decimals={1}
              duration={1500}
              className="text-[clamp(2.5rem,13vw,4rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-accent)]"
            />
            <span className="text-[13px] font-medium text-[var(--color-ink-tertiary)]">
              {t.results.outOf}
            </span>
          </div>

          {/* Bordered, per the reference — a filled pill at this size reads as
              a button, and the band is a reading, not an action. */}
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.6, duration: 0.35 }}
            className="mt-3 inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{
              borderColor: `${band.color}59`,
              backgroundColor: `${band.color}12`,
              color: band.color,
            }}
          >
            <span className="truncate">{bandLabel}</span>
          </motion.span>

          <p className="mt-3 text-[11.5px] leading-[1.5] text-[var(--color-ink-secondary)]">
            {explain === "score" ? t.results.percentileWhat : bandBlurb}
          </p>
        </div>

        {/* ---- Potential ---- */}
        {showPotential ? (
          <div className="min-w-0 border-l border-[var(--color-hairline)] pl-3">
            <SectionLabel
              label={t.results.potential}
              open={explain === "potential"}
              onToggle={() =>
                setExplain((v) => (v === "potential" ? null : "potential"))
              }
            />

            <div className="mt-2 flex justify-center">
              <PotentialRing
                value={potential.score}
                label={t.results.outOf}
                className="max-w-[148px]"
              />
            </div>

            <p className="mt-3 text-center text-[11.5px] leading-[1.5] text-[var(--color-ink-secondary)]">
              {explain === "potential"
                ? t.results.potentialWhat
                : t.results.potentialBody}
            </p>
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}

function SectionLabel({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {/* 10px at 0.05em, not 11 at 0.08: "POTENZIAL SCORE" is 125px set the
          old way and the column it lives in is 122px, so it truncated to
          "POTENZIAL-SCOR…" on every German phone. It wraps rather than
          truncates now — a clipped heading is worse than a two-line one. */}
      <span className="min-w-0 text-[10px] font-semibold uppercase leading-[1.2] tracking-[0.05em] text-[var(--color-ink)]">
        {label}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={label}
        className="-m-1 shrink-0 rounded-full p-1 text-[var(--color-ink-quaternary)] transition-colors hover:text-[var(--color-ink-secondary)]"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
