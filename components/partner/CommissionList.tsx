"use client";

import type { CommissionStatus } from "@/lib/affiliate/model";
import type { PlanId } from "@/lib/pricing";
import { fill, useI18n, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// The history: every purchase made through this partner's link.
//
// THE CUSTOMER'S ADDRESS IS ALREADY MASKED WHEN IT ARRIVES. The API sends
// maskEmail() output and nothing else, so there is no way for this component
// to leak a customer address even by accident — it never has one. What is
// shown is enough for a partner to recognise their own referral and useless
// to anybody else.

/** One row, exactly as /api/affiliate/me sends it. */
export interface CommissionRow {
  id: string;
  at: number;
  plan: PlanId;
  /** Already pseudonymised by the server. */
  customer: string;
  grossCents: number;
  amountCents: number;
  percent: number;
  level: number;
  status: CommissionStatus;
  maturesAt: number;
}

interface Props {
  items: CommissionRow[];
}

export function CommissionList({ items }: Props) {
  const t = useT();
  const { locale } = useI18n();

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <section className="border-t border-[var(--color-hairline)] pt-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
        {t.partner.dash.historyTitle}
      </h2>

      {items.length === 0 ? (
        <>
          <p className="mt-2 text-[15px] font-semibold text-[var(--color-ink)]">
            {t.partner.dash.emptyTitle}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.partner.dash.emptyBody}
          </p>
          {/* Three steps, no example figures: an earnings page that invents a
              first sale is the one lie a partner would notice last. */}
          <ol className="mt-4">
            {t.partner.dash.emptySteps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 border-t border-[var(--color-hairline)] py-3 first:border-t-0"
              >
                <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-[11px] font-bold text-[var(--color-accent)]">
                  {i + 1}
                </span>
                <span className="text-[12.5px] leading-[1.45] text-[var(--color-ink-secondary)]">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[12.5px] text-[var(--color-ink-tertiary)]">
            {t.partner.dash.historySub}
          </p>
          <ul className="mt-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 border-t border-[var(--color-hairline)] py-3.5 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13.5px] font-semibold leading-tight text-[var(--color-ink)]">
                    {t.plans[item.plan]?.name ?? item.plan}
                    <span className="tnum text-[11.5px] font-normal text-[var(--color-ink-tertiary)]">
                      {date(item.at)}
                    </span>
                  </p>
                  <p className="mt-1 text-[11.5px] leading-tight text-[var(--color-ink-tertiary)]">
                    <span className="font-mono">{item.customer}</span>
                    {" · "}
                    <span className="tnum">
                      {money(item.grossCents)} · {item.percent} %
                    </span>
                  </p>
                  <p className="mt-1.5">
                    <StatusPill
                      status={item.status}
                      label={
                        item.status === "pending"
                          ? fill(t.partner.dash.status.pending, { date: date(item.maturesAt) })
                          : t.partner.dash.status[item.status]
                      }
                    />
                  </p>
                </div>

                <p
                  className={cn(
                    "tnum shrink-0 text-[16px] font-bold leading-none",
                    item.status === "reversed"
                      ? "text-[var(--color-ink-quaternary)] line-through"
                      : "text-[var(--color-accent)]",
                  )}
                >
                  {money(item.amountCents)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function StatusPill({ status, label }: { status: CommissionStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]",
        status === "available" &&
          "border-[var(--color-accent)]/45 bg-[var(--color-accent-deep)] text-[var(--color-accent)]",
        status === "paid" && "border-[var(--color-accent)]/30 text-[var(--color-accent)]",
        status === "requested" && "border-[var(--color-caution)]/40 text-[var(--color-caution)]",
        (status === "pending" || status === "reversed") &&
          "border-[var(--color-hairline)] text-[var(--color-ink-tertiary)]",
      )}
    >
      {label}
    </span>
  );
}
