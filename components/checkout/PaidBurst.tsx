"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n";
import { formatPrice, type PlanId } from "@/lib/pricing";
import { useI18n } from "@/lib/i18n";

// The receipt beat: money moved, and the sheet says so before it hands over.
//
// It owns the HANDOVER, not just the picture. The animation runs for a known
// length (see PAID_BURST_MS), and this component fires onDone when it has
// been seen — so the moment cannot be cut off half-drawn by a parent closing
// the sheet on its own schedule, which is what happens when a component
// animates and something else decides when it is finished.
//
// The drawing lives in globals.css under PAYMENT CONFIRMED; everything here
// is markup and one timer.

/** Ring, check, halo, words — then the sheet may move on. */
export const PAID_BURST_MS = 1600;

export function PaidBurst({ plan, onDone }: { plan: PlanId; onDone: () => void }) {
  const t = useT();
  const { locale } = useI18n();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reduced motion still gets a beat — just a short one. Skipping it
    // entirely would mean the confirmation flashes past unread.
    const id = window.setTimeout(onDone, reduce ? 700 : PAID_BURST_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div className="paid" role="status" aria-live="polite">
      <div className="paid__mark">
        <span className="paid__halo" aria-hidden />
        <svg viewBox="0 0 100 100" aria-hidden>
          <circle className="paid__ring" cx="50" cy="50" r="45" />
          <path className="paid__check" d="M31 51.5 L44 64.5 L70 36" />
        </svg>
      </div>

      <div className="paid__text">
        <p className="t-title3 text-[var(--color-ink)]">{t.pay.paidTitle}</p>
        <p className="t-caption mt-1.5 text-[var(--color-ink-secondary)]">
          {t.plans[plan].name} · {formatPrice(locale, plan)}
        </p>
        <p className="t-caption mt-3 text-[var(--color-accent)]">{t.pay.paidUnlocking}</p>
      </div>
    </div>
  );
}
