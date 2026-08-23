"use client";

import { Coins, MousePointerClick, Users, Wallet } from "lucide-react";
import { useCountUp } from "./LevelRing";
import { useI18n, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// Four figures as a two-by-two quadrant divided by one crossing hairline —
// the home screen's pattern, because it is the same kind of object: numbers
// floating on the background rather than sitting in boxes.
//
// All four are real. There is no preview variant: a partner with nothing yet
// sees four zeroes and the empty state underneath explains them, which is
// honest in a way that example figures on an earnings page could never be.

interface Props {
  clicks: number;
  payingCustomers: number;
  earnedCents: number;
  availableCents: number;
}

export function PartnerStats({ clicks, payingCustomers, earnedCents, availableCents }: Props) {
  const t = useT();
  const { locale } = useI18n();

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);

  const cells = [
    { icon: MousePointerClick, value: clicks, label: t.partner.dash.statClicks, kind: "count" as const },
    { icon: Users, value: payingCustomers, label: t.partner.dash.statCustomers, kind: "count" as const },
    { icon: Coins, value: earnedCents, label: t.partner.dash.statEarned, kind: "money" as const },
    { icon: Wallet, value: availableCents, label: t.partner.dash.statAvailable, kind: "money" as const },
  ];

  return (
    <section className="border-t border-[var(--color-hairline)] pt-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
        {t.partner.dash.statsTitle}
      </h2>
      <div className="mt-2 grid grid-cols-2">
        {cells.map((cell, i) => (
          <Cell
            key={cell.label}
            {...cell}
            format={cell.kind === "money" ? money : (v: number) => String(Math.round(v))}
            className={cn(
              i % 2 === 1 && "border-l border-[var(--color-hairline)]",
              i >= 2 && "border-t border-[var(--color-hairline)]",
            )}
          />
        ))}
      </div>
    </section>
  );
}

function Cell({
  icon: Icon,
  value,
  label,
  format,
  className,
}: {
  icon: typeof Coins;
  value: number;
  label: string;
  format: (v: number) => string;
  className?: string;
}) {
  // Money counts up in cents and is formatted per frame, so the separator and
  // the currency symbol are the locale's throughout the animation rather than
  // appearing at the end.
  const shown = useCountUp(value);

  return (
    <div className={cn("flex flex-col items-center px-2 py-4 text-center sm:py-5", className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-hairline)] bg-white/[0.03] sm:h-11 sm:w-11">
        <Icon className="h-[18px] w-[18px] text-[var(--color-accent)]" aria-hidden />
      </span>
      <p className="tnum mt-2.5 whitespace-nowrap text-[20px] font-bold leading-none tracking-tight text-[var(--color-ink)] sm:text-[24px]">
        {format(shown)}
      </p>
      <p className="mt-2 text-[10.5px] leading-[1.3] text-[var(--color-ink-tertiary)] sm:text-[12px]">
        {label}
      </p>
    </div>
  );
}
