"use client";

import { POSITION_ICON, POSITION_LABEL, type Metric } from "@/lib/metrics";
import { cn } from "@/lib/cn";

/**
 * Table view of the full measurement set. Required twin for the meters —
 * every value stays reachable without relying on colour or hover, and past
 * ~7 classes a table is simply the better form.
 *
 * tabular-nums belongs here (columns that align), not on the hero figure.
 */
export function MeasurementTable({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10">
            {["Measurement", "Value", "Reference", "Status", "Score"].map(
              (h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn(
                    "pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500",
                    i > 0 && "text-right",
                  )}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr
              key={m.id}
              className="border-b border-white/[0.05] last:border-0"
            >
              <th
                scope="row"
                className="py-3 text-[13px] font-normal text-zinc-300"
              >
                <span className="mr-2" aria-hidden>
                  {m.emoji}
                </span>
                {m.label}
              </th>
              <td className="py-3 text-right text-[13px] tabular-nums text-zinc-100">
                {m.display}
              </td>
              <td className="py-3 text-right text-[13px] tabular-nums text-zinc-500">
                {m.ideal[0]}–{m.ideal[1]}
              </td>
              <td
                className={cn(
                  "py-3 text-right text-[12px]",
                  m.position === "in" ? "text-accent" : "text-amber-400",
                )}
              >
                <span aria-hidden>{POSITION_ICON[m.position]}</span>{" "}
                {POSITION_LABEL[m.position].replace(" reference range", "")}
              </td>
              <td className="py-3 text-right text-[13px] tabular-nums text-zinc-300">
                {m.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
