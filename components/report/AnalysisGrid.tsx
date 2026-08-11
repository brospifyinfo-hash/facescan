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
import { cn } from "@/lib/cn";

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
 * The detailed analysis: one tile per module, two to a row.
 *
 * An odd tile at the end SPANS BOTH COLUMNS rather than sitting next to a
 * hole. The row count is data-dependent — eight modules on a real scan, five
 * composites on the demo path — so the layout has to survive both without a
 * ragged corner.
 */
export function AnalysisGrid({ rows }: { rows: AnalysisRow[] }) {
  const t = useT();
  const reduce = useReducedMotion();
  const odd = rows.length % 2 === 1;

  return (
    <section>
      <h2 className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
        {t.results.detailed}
      </h2>

      <div className="grid grid-cols-2 gap-2.5">
        {rows.map((row, i) => {
          const Icon = ICON[row.id];
          const last = odd && i === rows.length - 1;

          return (
            <motion.div
              key={row.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: reduce ? 0 : 0.05 * i,
                ease: [0.32, 0.72, 0, 1],
              }}
              className={cn("panel p-3.5", last && "col-span-2")}
            >
              <div className="flex items-start gap-2">
                <Icon className="mt-px h-4 w-4 shrink-0 text-[var(--color-accent)]" />
                <p className="min-w-0 flex-1 text-[12px] font-medium leading-tight text-[var(--color-ink-secondary)]">
                  {t.results.modules[row.id]}
                </p>
              </div>

              {row.score === null ? (
                <>
                  <p className="mt-2 text-[15px] font-semibold text-[var(--color-ink-tertiary)]">
                    {t.results.notMeasured}
                  </p>
                  {/* The reason, not a zeroed bar. A bar at 0 says "scored
                      badly"; this module was not scored at all. */}
                  <p className="t-caption mt-1.5 line-clamp-2 leading-snug text-[var(--color-ink-quaternary)]">
                    {row.note ?? ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 flex items-baseline gap-0.5">
                    <CountUp
                      value={row.score}
                      decimals={1}
                      duration={1100}
                      delay={200 + i * 60}
                      className="text-[21px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-ink)]"
                    />
                    <span className="text-[11px] font-medium text-[var(--color-ink-tertiary)]">
                      /10
                    </span>
                  </p>

                  <span className="bar-track mt-2.5 block">
                    <motion.span
                      className="bar-fill"
                      initial={reduce ? { width: `${row.score * 10}%` } : { width: 0 }}
                      animate={{ width: `${row.score * 10}%` }}
                      transition={{
                        duration: 0.9,
                        delay: reduce ? 0 : 0.2 + i * 0.06,
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
