"use client";

import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import type { ScanMetrics } from "@/lib/store";
import { SPECS } from "@/lib/specs";

/**
 * Raw measurement dump, shown on /results?raw=1.
 *
 * Exists because the reference bands were calibrated against a SYNTHETIC
 * face built from millimetre tables and my own assumptions about where
 * MediaPipe places each landmark. That validated the model against itself
 * and nothing else — if the real mesh sits differently, every band is off
 * and real photos score at the floor no matter how the face looks.
 *
 * The only way to fix that is real numbers from real photos. This panel
 * makes them copyable so the bands can be re-cut against actual data.
 */
export function RawDiagnostics({ metrics }: { metrics: ScanMetrics }) {
  const [copied, setCopied] = useState(false);

  const payload = {
    overall: metrics.overall,
    harmony: metrics.harmony,
    symmetry: metrics.symmetry,
    categories: {
      eyes: metrics.eyesScore,
      jaw: metrics.jawScore,
      proportions: metrics.proportionsScore,
      midface: metrics.midfaceScore,
    },
    measurements: Object.fromEntries(
      metrics.metrics.map((m) => [
        m.id,
        { value: m.value, band: m.ideal, score: m.score, position: m.position },
      ]),
    ),
  };
  const text = JSON.stringify(payload, null, 2);

  return (
    <section className="surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          🔧 Raw measurements
        </h2>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked — the text is selectable below */
            }
          }}
          className="fill interactive flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-[var(--color-ink-secondary)]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-accent" /> Copied
            </>
          ) : (
            <>
              <ClipboardCopy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
        Diagnostic view. Every value below is the measurement as computed from
        this photo, next to the reference band it is checked against. Send this
        block along with a rough description of the face so the bands can be
        recalibrated against real data instead of a synthetic model.
      </p>

      <table className="mt-4 w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/10 text-[var(--color-ink-tertiary)]">
            <th className="pb-2 font-medium">metric</th>
            <th className="pb-2 text-right font-medium">measured</th>
            <th className="pb-2 text-right font-medium">band</th>
            <th className="pb-2 text-right font-medium">dir</th>
            <th className="pb-2 text-right font-medium">score</th>
          </tr>
        </thead>
        <tbody className="font-mono-terminal">
          {metrics.metrics.map((m) => (
            <tr key={m.id} className="border-b border-white/[0.05] last:border-0">
              <td className="py-1.5 text-[var(--color-ink-secondary)]">{m.id}</td>
              <td
                className={`py-1.5 text-right tabular-nums ${
                  m.position === "in" ? "text-accent" : "text-amber-400"
                }`}
              >
                {m.value}
              </td>
              <td className="py-1.5 text-right tabular-nums text-[var(--color-ink-tertiary)]">
                {m.ideal[0]}–{m.ideal[1]}
              </td>
              <td className="py-1.5 text-right text-[var(--color-ink-tertiary)]">
                {SPECS[m.id].dir}
              </td>
              <td className="py-1.5 text-right tabular-nums text-[var(--color-ink-secondary)]">
                {m.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-black/40 p-3 t-caption leading-relaxed text-[var(--color-ink-secondary)]">
        {text}
      </pre>
    </section>
  );
}
