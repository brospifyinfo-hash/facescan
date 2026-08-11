"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CountUp } from "@/components/dashboard/CountUp";
import {
  IconEyes,
  IconFaceShape,
  IconJaw,
  IconLips,
  IconNose,
  IconProportions,
  IconSkin,
  IconSymmetry,
} from "./icons";
import { useT } from "@/lib/i18n";
import type { AnalysisRow, RowId } from "@/lib/report-model";

const ICON: Record<RowId, (p: { className?: string }) => React.ReactElement> = {
  symmetry: IconSymmetry,
  jaw: IconJaw,
  skin: IconSkin,
  eyes: IconEyes,
  nose: IconNose,
  lips: IconLips,
  proportions: IconProportions,
  faceShape: IconFaceShape,
  midface: IconNose,
};

/**
 * The detailed analysis: one panel, its heading inside it, and the modules
 * as tiles on a four-column grid — the reference's arrangement.
 *
 * FOUR COLUMNS FROM 360px, TWO BELOW IT. The reference is drawn at 430, where
 * four 84px tiles each hold their label on one line. Below 360 a tile is
 * ~60px and a twelve-character German label ("Hautqualität", "Gesichtsform")
 * has nowhere to go — no break opportunity, so it overflows rather than
 * wraps. Between 360 and 430 the label takes two lines and the grid rows
 * stay flush because grid stretches them together.
 */
export function AnalysisGrid({ rows }: { rows: AnalysisRow[] }) {
  const t = useT();
  const reduce = useReducedMotion();

  return (
    <section className="panel p-[var(--pad-panel)]">
      <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.11em] text-[var(--color-ink)]">
        {t.results.detailed}
      </h2>

      <div className="mt-3.5 grid grid-cols-2 gap-2 min-[360px]:grid-cols-4">
        {rows.map((row, i) => {
          const Icon = ICON[row.id];

          return (
            <motion.div
              key={row.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: reduce ? 0 : 0.04 * i,
                ease: [0.32, 0.72, 0, 1],
              }}
              // A fill, not another panel: these sit ON a panel, and a card
              // inside a card is the thing that makes a layout look nested
              // rather than composed.
              className="flex flex-col rounded-[14px] border border-white/[0.06] bg-white/[0.022] p-2"
            >
              <div className="flex items-start gap-1.5">
                <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                {/* hyphens AND break-words. "Augenbereich" and
                    "Hautqualität" are single words with no break opportunity,
                    so in a 38px label slot they did not wrap — they
                    overflowed the tile and were clipped mid-word. Hyphens
                    give a clean German break where the browser has the
                    dictionary; break-words is the floor for when it does
                    not. */}
                <p
                  className="min-w-0 hyphens-auto break-words text-[10px] font-medium leading-[1.15] text-[var(--color-ink-secondary)]"
                  title={t.results.modules[row.id]}
                >
                  {t.results.modules[row.id]}
                </p>
              </div>

              {row.score === null ? (
                <p className="mt-auto pt-2 text-[10.5px] font-medium leading-tight text-[var(--color-ink-tertiary)]">
                  {t.results.notMeasured}
                </p>
              ) : (
                <>
                  <p className="mt-auto flex items-baseline pt-2">
                    <CountUp
                      value={row.score}
                      decimals={1}
                      duration={1100}
                      delay={200 + i * 60}
                      className="text-[15px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-ink)]"
                    />
                    <span className="text-[9px] font-medium text-[var(--color-ink-tertiary)]">
                      /10
                    </span>
                  </p>

                  <span className="bar-track mt-2 block">
                    <motion.span
                      className="bar-fill"
                      initial={reduce ? { width: `${row.score * 10}%` } : { width: 0 }}
                      animate={{ width: `${row.score * 10}%` }}
                      transition={{
                        duration: 0.9,
                        delay: reduce ? 0 : 0.2 + i * 0.05,
                        ease: [0.32, 0.72, 0, 1],
                      }}
                    />
                  </span>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
