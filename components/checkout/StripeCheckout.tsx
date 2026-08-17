"use client";

import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { PaymentForm } from "./PaymentForm";
import { BrandSpinner } from "@/components/ui/BrandLoader";
import {
  appearance,
  createPaymentIntent,
  isStripeAvailable,
  stripePromise,
  type Amounts,
} from "@/lib/stripe/client";
import { useI18n, useT } from "@/lib/i18n";
import type { PlanId } from "@/lib/pricing";

const INTL_LOCALE: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

/**
 * Creates the PaymentIntent, then mounts Elements around it.
 *
 * Elements needs the clientSecret at mount time and will not accept a new
 * one afterwards, so the intent is fetched first and the provider is keyed
 * on it — changing plan tears the whole tree down and rebuilds it, which is
 * the supported way to switch amounts.
 */
export function StripeCheckout({
  plan,
  onBack,
  onPaid,
}: {
  plan: PlanId;
  onBack: () => void;
  onPaid: (plan: PlanId) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Amounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency: "eur" | "usd" = locale === "en" ? "usd" : "eur";

  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    setAmounts(null);
    setError(null);

    if (!isStripeAvailable()) {
      setError(t.pay.unconfigured);
      return;
    }

    createPaymentIntent(plan, currency)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(
            res.error === "unconfigured"
              ? t.pay.unconfigured
              : res.error === "unauthenticated"
                ? t.auth.title
                : t.pay.errors.generic,
          );
          return;
        }
        setClientSecret(res.data.clientSecret);
        setAmounts(res.data.amounts);
      })
      // WITHOUT THIS the checkout hangs forever. A rejected promise — the
      // phone dropping to no signal, a 502 with an HTML body that fails to
      // parse — set no error and no client secret, so the component stayed on
      // its loading branch, which has no back button and no retry. The only
      // way out was closing the modal, and nothing anywhere said why.
      .catch(() => {
        if (!cancelled) setError(t.pay.errors.network);
      });

    return () => {
      cancelled = true;
    };
  }, [plan, currency, t]);

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-[12px] leading-relaxed text-amber-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-1.5 text-[12px] text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t.quiz.back}
        </button>
      </div>
    );
  }

  if (!clientSecret || !amounts) {
    // The back link is here too, not only in the error branch. A slow network
    // is indistinguishable from a stuck one while you are looking at it, and a
    // waiting screen with no way out is what makes people close the tab.
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <BrandSpinner label={t.checkout.processing} />
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t.quiz.back}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-[12px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink-secondary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t.checkout.choosePlan}
      </button>

      <Elements
        key={clientSecret}
        stripe={stripePromise()}
        options={{ clientSecret, appearance, locale }}
      >
        <PaymentForm
          plan={plan}
          amounts={amounts}
          intlLocale={INTL_LOCALE[locale] ?? "en-US"}
          onPaid={onPaid}
        />
      </Elements>
    </div>
  );
}
