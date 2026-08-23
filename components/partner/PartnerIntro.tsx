"use client";

import Link from "next/link";
import { Link2, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";

// The public half of /partner: what the programme is, for somebody who has
// never signed in.
//
// WHY THERE IS NOT A SINGLE NUMBER IN HERE
// Percentages, thresholds, hold time and minimum payout all live in the
// admin configuration and can be changed at any moment. A visitor reading
// this page is not signed in, so the server has sent no configuration with
// it — anything concrete would have to be hardcoded in the dictionary, and a
// dictionary that promises "20 %" keeps promising it after the owner drops
// the rate to 10. The figures appear one screen later, in the dashboard,
// where every one of them is read out of the store.

interface Props {
  /** Rendered instead of the sign-in call when the programme is switched off. */
  disabled?: boolean;
}

export function PartnerIntro({ disabled = false }: Props) {
  const t = useT();
  const icons = [Link2, Send, Wallet];

  return (
    <>
      <header>
        {/* Not .t-eyebrow: that class sets its own colour from an unlayered
            rule in globals.css, which outranks any Tailwind text-colour
            utility put beside it. Spelled out, the accent actually applies. */}
        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.09em] text-[var(--color-accent)]">
          {t.partner.intro.eyebrow}
        </p>
        <h1 className="t-title1 mt-2 text-balance">
          {t.partner.intro.headline}{" "}
          <span className="text-[var(--color-accent)]">{t.partner.intro.headlineAccent}</span>
        </h1>
        <p className="t-callout mt-3 leading-relaxed text-[var(--color-ink-secondary)]">
          {t.partner.intro.sub}
        </p>
      </header>

      {/* Three steps as rungs. Hairlines and whitespace, no cards — the same
          rule the dashboard follows, so the two halves of this route read as
          one page rather than as two products. */}
      <ol className="mt-8 border-t border-[var(--color-hairline)]">
        {t.partner.intro.steps.map((step, i) => {
          const Icon = icons[i];
          return (
            <li
              key={step.title}
              className="flex items-start gap-3.5 border-b border-[var(--color-hairline)] py-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02]">
                <Icon className="h-[18px] w-[18px] text-[var(--color-accent)]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold leading-tight text-[var(--color-ink)]">
                  {step.title}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
                  {step.text}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {disabled ? (
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
            {t.partner.disabledTitle}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.partner.disabledBody}
          </p>
        </section>
      ) : (
        <section className="mt-8 text-center">
          {/* /konto is the door: it holds the whole sign-in flow already, and
              a second one here would be a second place to keep correct. */}
          <Link href="/konto">
            <Button size="lg">{t.partner.intro.cta}</Button>
          </Link>
          <p className="t-caption mx-auto mt-3 max-w-xs leading-relaxed text-[var(--color-ink-tertiary)]">
            {t.partner.intro.ctaNote}
          </p>
        </section>
      )}

      <section className="mt-9 border-t border-[var(--color-hairline)] pt-6">
        <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
          {t.partner.intro.levelsTitle}
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
          {t.partner.intro.levelsBody}
        </p>
      </section>

      <section className="mt-6 border-t border-[var(--color-hairline)] pt-6">
        <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
          {t.partner.intro.payoutTitle}
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
          {t.partner.intro.payoutBody}
        </p>
      </section>
    </>
  );
}
