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
 * The payoff. One panel, two figures, and a hard rule about their weights:
 * the headline is the only numeral on the page set at display size, and the
 * potential is an arc. Two 68px numerals side by side would read as two
 * results and leave the user deciding which one is theirs.
 *
 * The info buttons are not decoration. The percentile behind the headline and
 * the derivation behind the potential are both things a paying user is
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
  // out of reference. Showing "8.2 / 8.2" would invite the user to read a
  // rounding artefact as headroom.
  const showPotential = potential !== null && potential.lift > 0;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08, ease: [0.32, 0.72, 0, 1] }}
      className="panel overflow-hidden p-[var(--pad-panel)]"
    >
      <div
        className={
          showPotential
            ? "grid gap-5 min-[380px]:grid-cols-[minmax(0,1fr)_auto] min-[380px]:items-center min-[380px]:gap-5"
            : "grid gap-5"
        }
      >
        {/* ---- Overall ---- */}
        <div className="min-w-0">
          <SectionLabel
            label={t.results.overall}
            open={explain === "score"}
            onToggle={() => setExplain((v) => (v === "score" ? null : "score"))}
          />

          {/* Two sizes, and the split one is not a compromise — it is the
              correct size for the column it is in. A 17vw numeral beside a
              fixed 148px ring leaves "von 10" fighting the last 7px of a
              153px column at 390. When the numeral owns the full width it
              goes back to display scale. */}
          <div className="mt-2 flex items-baseline gap-1.5">
            <CountUp
              value={score}
              decimals={1}
              duration={1500}
              className={
                showPotential
                  ? "text-[clamp(2.75rem,12vw,3.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-accent)]"
                  : "text-[clamp(3.25rem,17vw,4.25rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--color-accent)]"
              }
            />
            <span className="text-[15px] font-medium text-[var(--color-ink-tertiary)]">
              {t.results.outOf}
            </span>
          </div>

          <motion.span
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.6, duration: 0.35 }}
            className="mt-3 inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ backgroundColor: `${band.color}1a`, color: band.color }}
          >
            <span className="truncate">{bandLabel}</span>
          </motion.span>

          <p className="t-caption mt-3 leading-relaxed text-[var(--color-ink-secondary)]">
            {explain === "score" ? t.results.percentileWhat : bandBlurb}
          </p>
        </div>

        {/* ---- Potential ---- */}
        {showPotential ? (
          <div className="min-[380px]:w-[148px] min-[380px]:border-l min-[380px]:border-[var(--color-hairline)] min-[380px]:pl-4 border-t border-[var(--color-hairline)] pt-5 min-[380px]:border-t-0 min-[380px]:pt-0">
            <SectionLabel
              label={t.results.potential}
              open={explain === "potential"}
              onToggle={() =>
                setExplain((v) => (v === "potential" ? null : "potential"))
              }
            />

            <div className="mt-3 flex justify-center">
              <PotentialRing value={potential.score} label={t.results.outOf} />
            </div>

            <p className="t-caption mt-3 text-center leading-relaxed text-[var(--color-ink-secondary)] min-[380px]:text-left">
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-secondary)]">
        {label}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={label}
        className="-m-1 rounded-full p-1 text-[var(--color-ink-quaternary)] transition-colors hover:text-[var(--color-ink-secondary)]"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
