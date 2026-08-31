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
  clearInFlight,
  readInFlight,
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
  email,
  onBack,
  onPaid,
}: {
  plan: PlanId;
  /** Die im Sheet eingegebene Adresse; leer, wenn angemeldet. */
  email: string;
  onBack: () => void;
  onPaid: (plan: PlanId) => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Amounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Finishing a payment that was made before this component remounted. */
  const [resuming, setResuming] = useState(false);

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

    // A CHARGE THAT IS ALREADY OUT THERE IS NOT A REASON TO OPEN A NEW ONE.
    //
    // Every exit from this sheet unmounts the form, and with it the `charged`
    // latch that makes paying twice impossible. Somebody who closes the sheet
    // while the confirmation is still spinning — a very natural thing to do
    // when nothing seems to be happening — used to come back to a fresh
    // PaymentIntent and a live pay button, on a card that had already been
    // charged. The marker in sessionStorage outlives the component, so the
    // second visit finishes the FIRST payment instead of starting a second.
    //
    // Finishing is safe: /api/stripe/confirm asks Stripe whether this intent
    // really succeeded and whether it belongs to this session, and granting
    // the same plan twice is a no-op.
    const pending = readInFlight();
    if (pending) {
      setResuming(true);
      void (async () => {
        try {
          const res = await fetch("/api/stripe/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: pending.id }),
          });
          const data = (await res.json().catch(() => null)) as { plan?: PlanId } | null;
          if (cancelled) return;
          if (res.ok && data?.plan) {
            clearInFlight();
            onPaid(data.plan);
            return;
          }
        } catch {
          /* fall through: treat it as a normal, unpaid checkout */
        }
        // Stripe does not know it, or it never succeeded — the marker is
        // stale and would otherwise block buying forever.
        if (!cancelled) {
          clearInFlight();
          setResuming(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    createPaymentIntent(plan, currency, locale, email)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(
            res.error === "unconfigured"
              ? t.pay.unconfigured
              : res.error === "account_exists"
                ? t.pay.errors.accountExists
                : res.error === "unauthenticated" || res.error === "invalid_email"
                  ? t.pay.errors.emailNeeded
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
  }, [plan, currency, locale, email, t]);

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

  if (resuming) {
    // Deliberately without a back link: this branch means a card has already
    // been charged and we are asking Stripe what became of it. It resolves in
    // about a second, and offering a way out here is offering a way to buy
    // the same thing twice.
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <BrandSpinner label={t.pay.confirming} />
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
