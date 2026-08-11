"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Check } from "lucide-react";
import { FaceWireframe } from "./FaceWireframe";
import { IconBolt, IconCrown } from "./icons";
import { useT } from "@/lib/i18n";
import type { MetricId, PlanId } from "@/lib/metrics";

// Strengths and optimisation — a pair, and they read as one because they are
// built from one primitive with two tints.
//
// THEY STACK. ALWAYS. The reference puts them in two columns at phone width,
// which works for the four-word English bullets in a mock. The real strings
// are German plan titles — "Frisur an Gesichtsform anpassen", "Körperfett
// Richtung 12–18 % senken" — and a column narrow enough to fit two of these
// side by side breaks every one of them across three lines.
//
// A `min-[560px]:grid-cols-2` was tried and is the wrong tool regardless of
// the number: Tailwind's breakpoints are VIEWPORT queries, and the report is
// inside a `max-w-md` column, so past 560px of viewport the rule kept firing
// against a container that had stopped growing at 448px. The result was two
// 202px columns on a wide desktop — the exact layout the rule existed to
// avoid. Full width is the only width these panels ever get.

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
    <div className="flex items-center gap-2">
      <span style={{ color }} aria-hidden>
        {icon}
      </span>
      <h2
        className="text-[12px] font-semibold uppercase tracking-[0.1em]"
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
    <section className="panel panel-lit-accent relative overflow-hidden p-[var(--pad-panel)]">
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <PanelHead
            icon={<IconCrown className="h-4 w-4" />}
            title={t.results.strengthsTitle}
            tone="accent"
          />

          <ul className="mt-3.5 space-y-2.5">
            {items.map((item, i) => (
              <motion.li
                key={item.id}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: reduce ? 0 : 0.1 + i * 0.07 }}
                className="flex items-start gap-2"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15">
                  <Check
                    className="h-2.5 w-2.5 text-[var(--color-accent)]"
                    strokeWidth={3}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 text-[12.5px] leading-snug text-[var(--color-ink-secondary)]">
                  {t.metrics[item.id].label}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <FaceWireframe className="h-auto w-[100px] shrink-0 self-center min-[380px]:w-[124px]" />
      </div>
    </section>
  );
}

export function OptimizePanel({
  items,
}: {
  items: Array<{ id: PlanId }>;
}) {
  const t = useT();
  const reduce = useReducedMotion();

  return (
    <section className="panel panel-lit-amber relative overflow-hidden p-[var(--pad-panel)]">
      <div className="relative">
        <PanelHead
          icon={<IconBolt className="h-4 w-4" />}
          title={t.results.optimizeTitle}
          tone="amber"
        />

        <ul className="mt-3.5 space-y-2.5">
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : 0.1 + i * 0.06 }}
              className="flex items-start gap-2"
            >
              {/* An arrow, not a cross. The list is what to do next, and a
                  cross beside someone's face is a verdict. */}
              <ArrowUp
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-caution)]"
                strokeWidth={2.4}
                aria-hidden
              />
              <span className="min-w-0 text-[12.5px] leading-snug text-[var(--color-ink-secondary)]">
                {t.plan[item.id].title}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
