"use client";

import { METRIC_EMOJI, POSITION_ICON, type Metric } from "@/lib/metrics";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

/**
 * Table view of the full measurement set. Required twin for the dials —
 * every value stays reachable without relying on colour, shape or hover,
 * and past ~7 classes a table is simply the better form.
 *
 * tabular-nums belongs here (columns that align), not on the hero figure.
 */
export function MeasurementTable({ metrics }: { metrics: Metric[] }) {
  const t = useT();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10">
            {t.results.tableHead.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  "pb-3 t-eyebrow text-[var(--color-ink-tertiary)]",
                  i > 0 && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.id} className="border-b border-white/[0.05] last:border-0">
              <th
                scope="row"
                className="py-3 text-[13px] font-normal text-[var(--color-ink-secondary)]"
              >
                <span className="mr-2" aria-hidden>
                  {METRIC_EMOJI[m.id]}
                </span>
                {t.metrics[m.id].label}
              </th>
              <td className="py-3 text-right text-[13px] tabular-nums text-[var(--color-ink)]">
                {m.display}
              </td>
              <td className="py-3 text-right text-[13px] tabular-nums text-[var(--color-ink-tertiary)]">
                {m.ideal[0]}–{m.ideal[1]}
              </td>
              <td
                className={cn(
                  "py-3 text-right text-[12px]",
                  m.position === "in" ? "text-accent" : "text-amber-400",
                )}
              >
                <span aria-hidden>{POSITION_ICON[m.position]}</span>{" "}
                {t.statusShort[m.position]}
              </td>
              <td className="py-3 text-right text-[13px] tabular-nums text-[var(--color-ink-secondary)]">
                {m.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
