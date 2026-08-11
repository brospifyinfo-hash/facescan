"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Check } from "lucide-react";
import { FaceWireframe } from "./FaceWireframe";
import { IconBolt, IconCrown } from "./icons";
import { useT } from "@/lib/i18n";
import type { MetricId, PlanId } from "@/lib/metrics";

// Strengths and optimisation — a pair, side by side, built from one primitive
// with two tints so they read as two halves of one statement.
//
// THE OPTIMISATION LIST USES plan[].short, NOT plan[].title. A half-width
// card is ~137px of text column on a 375px phone, and the full titles are
// sentences — "Gua Sha entlang Kiefer und unter den Augen" is four lines
// there. The short forms are the same advice named in three words; the full
// title, the detail and the cadence are all still on the action plan below.
//
// THE WIREFRAME IS A BACKGROUND, not a column. In the reference it sits to
// the right of the checkmarks, which works because the mock's card is wide.
// Reserving 45% of a 137px column for it would leave the strengths list four
// characters wide, so it is placed behind the list at low opacity instead —
// same composition, same visual weight, no space taken from the text.

function PanelHead({
  icon,
  title,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  tone: "accent" | "amber";
}) {
  const color = tone === "accent" ? "var(--color-accent)" : "var(--color-caution)";
  return (
    <div className="flex items-center gap-1.5">
      <span className="shrink-0" style={{ color }} aria-hidden>
        {icon}
      </span>
      {/* "OPTIMIERUNGSPOTENZIAL" is twenty-one characters with no break
          opportunity in it, and the card is 124px wide. Without hyphens it
          does not wrap — it overflows and gets clipped mid-word. */}
      <h2
        className="min-w-0 hyphens-auto break-words text-[9.5px] font-semibold uppercase leading-tight tracking-[0.06em]"
        style={{ color }}
      >
        {title}
      </h2>
    </div>
  );
}

export function StrengthsPanel({
  items,
}: {
  items: Array<{ id: MetricId; score: number }>;
}) {
  const t = useT();
  const reduce = useReducedMotion();

  return (
    <section className="panel panel-lit-accent relative overflow-hidden p-3.5">
      {/* Bottom right, fully inside the card. Two things were wrong before:
          at half opacity it washed out to a smudge and stopped reading as a
          mesh at all — the reference's wireframe is plainly drawn, not a
          watermark — and a negative bottom offset cut the neck off at the
          card edge, which turns a profile into an unidentifiable shape. */}
      <FaceWireframe className="pointer-events-none absolute bottom-1.5 right-0 h-[60%] w-auto" />

      <div className="relative">
        <PanelHead
          icon={<IconCrown className="h-3.5 w-3.5" />}
          title={t.results.strengthsTitle}
          tone="accent"
        />

        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : 0.1 + i * 0.07 }}
              className="flex items-start gap-1.5"
            >
              <span className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15">
                <Check
                  className="h-2 w-2 text-[var(--color-accent)]"
                  strokeWidth={3.5}
                  aria-hidden
                />
              </span>
              <span className="min-w-0 text-[11px] leading-[1.3] text-[var(--color-ink-secondary)]">
                {t.metrics[item.id].label}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function OptimizePanel({ items }: { items: Array<{ id: PlanId }> }) {
  const t = useT();
  const reduce = useReducedMotion();

  return (
    <section className="panel panel-lit-amber relative overflow-hidden p-3.5">
      <div className="relative">
        <PanelHead
          icon={<IconBolt className="h-3.5 w-3.5" />}
          title={t.results.optimizeTitle}
          tone="amber"
        />

        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : 0.1 + i * 0.06 }}
              className="flex items-start gap-1.5"
            >
              {/* An arrow, not a cross. The list is what to do next, and a
                  cross beside someone's face is a verdict. */}
              <ArrowUp
                className="mt-px h-3 w-3 shrink-0 text-[var(--color-caution)]"
                strokeWidth={2.6}
                aria-hidden
              />
              <span className="min-w-0 text-[11px] leading-[1.3] text-[var(--color-ink-secondary)]">
                {t.plan[item.id].short}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
