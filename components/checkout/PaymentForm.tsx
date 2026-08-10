"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExpressCheckoutElement,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { StripeError } from "@stripe/stripe-js";
import { AlertCircle, Loader2, Lock, ShieldCheck } from "lucide-react";
import { PaymentIcons } from "./PaymentIcons";
import { fill, useT } from "@/lib/i18n";
import { VAT_RATE_PERCENT, type Amounts } from "@/lib/stripe/client";
import type { PlanId } from "@/lib/pricing";
import { cn } from "@/lib/cn";

/** Map Stripe's machine codes onto sentences a buyer can act on. */
function messageFor(err: StripeError, t: ReturnType<typeof useT>): string {
  const e = t.pay.errors;
  if (err.type === "validation_error") return err.message ?? e.generic;
  switch (err.decline_code ?? err.code) {
    case "insufficient_funds":
      return e.insufficientFunds;
    case "expired_card":
      return e.expiredCard;
    case "incorrect_cvc":
    case "invalid_cvc":
      return e.incorrectCvc;
    case "card_declined":
    case "generic_decline":
    case "do_not_honor":
      return e.declined;
    case "authentication_required":
      return e.authRequired;
    case "processing_error":
      return e.processingError;
    default:
      return err.type === "api_connection_error" ? e.network : e.generic;
  }
}

function money(minor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minor / 100);
}

export function PaymentForm({
  plan,
  amounts,
  intlLocale,
  onPaid,
}: {
  plan: PlanId;
  amounts: Amounts;
  intlLocale: string;
  onPaid: (plan: PlanId) => void;
}) {
  const t = useT();
  const stripe = useStripe();
  const elements = useElements();

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedWithdrawal, setAcceptedWithdrawal] = useState(false);
  const [showConsentHint, setShowConsentHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "paying" | "confirming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const consented = acceptedTerms && acceptedWithdrawal;

  /**
   * The webhook is the authority on what was bought, so after Stripe reports
   * success we wait for the entitlement to actually appear rather than
   * unlocking on the client's say-so.
   */
  const waitForEntitlement = useCallback(async () => {
    setPhase("confirming");
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch("/api/stripe/entitlement");
        const data = await res.json();
        if (data.plan) {
          setPhase("done");
          onPaid(data.plan as PlanId);
          return;
        }
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    // Paid but not yet granted — say so honestly instead of failing silently.
    setError(t.pay.errors.timeout);
    setBusy(false);
    setPhase("idle");
  }, [onPaid, t]);

  const confirm = async (viaExpress: boolean) => {
    if (!stripe || !elements) return;
    if (!consented) {
      setShowConsentHint(true);
      return;
    }
    setBusy(true);
    setError(null);
    setPhase("paying");

    const submit = await elements.submit();
    if (submit.error) {
      setError(messageFor(submit.error, t));
      setBusy(false);
      setPhase("idle");
      return;
    }

    const { error: err } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}/results` },
    });

    if (err) {
      setError(messageFor(err, t));
      setBusy(false);
      setPhase("idle");
      return;
    }
    void viaExpress;
    await waitForEntitlement();
  };

  // Express wallets must not bypass the legal confirmations, so the element
  // stays disabled until both boxes are ticked.
  useEffect(() => {
    if (consented) setShowConsentHint(false);
  }, [consented]);

  const rate = String(VAT_RATE_PERCENT);
  const isEur = amounts.currency === "eur";

  const legalLine = (
    template: string,
    parts: Record<string, { label: string; href: string }>,
  ) => {
    const nodes: React.ReactNode[] = [];
    let rest = template;
    let key = 0;
    while (true) {
      const match = rest.match(/\{(\w+)\}/);
      if (!match || match.index === undefined) break;
      nodes.push(rest.slice(0, match.index));
      const part = parts[match[1]];
      nodes.push(
        part ? (
          <a
            key={key++}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:text-accent-bright"
          >
            {part.label}
          </a>
        ) : (
          match[0]
        ),
      );
      rest = rest.slice(match.index + match[0].length);
    }
    nodes.push(rest);
    return nodes;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Order summary ---------- */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <h3 className="font-mono-terminal t-eyebrow text-[var(--color-ink-tertiary)]">
          {t.pay.summaryTitle}
        </h3>
        <dl className="mt-3 flex flex-col gap-1.5 text-[13px]">
          {isEur ? (
            <>
              <div className="flex justify-between text-[var(--color-ink-secondary)]">
                <dt>{t.pay.net}</dt>
                <dd className="tabular-nums">
                  {money(amounts.netMinor, amounts.currency, intlLocale)}
                </dd>
              </div>
              <div className="flex justify-between text-[var(--color-ink-secondary)]">
                <dt>{fill(t.pay.vat, { rate })}</dt>
                <dd className="tabular-nums">
                  {money(amounts.vatMinor, amounts.currency, intlLocale)}
                </dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between text-[var(--color-ink-secondary)]">
            <dt>{t.pay.shipping}</dt>
            <dd className="text-[var(--color-ink-tertiary)]">{t.pay.shippingFree}</dd>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between border-t border-white/[0.08] pt-2.5">
            <dt className="text-[14px] font-semibold text-[var(--color-ink)]">{t.pay.total}</dt>
            <dd className="text-[17px] font-semibold tabular-nums text-[var(--color-ink)]">
              {money(amounts.amountMinor, amounts.currency, intlLocale)}
            </dd>
          </div>
        </dl>
        {isEur ? (
          <p className="mt-1 text-right t-caption text-[var(--color-ink-tertiary)]">
            {fill(t.pay.inclVat, { rate })}
          </p>
        ) : null}
      </section>

      {/* ---------- Express wallets ---------- */}
      <div
        className={cn(
          "transition-opacity",
          consented ? "opacity-100" : "pointer-events-none opacity-40",
        )}
        onClickCapture={(e) => {
          if (!consented) {
            e.preventDefault();
            e.stopPropagation();
            setShowConsentHint(true);
          }
        }}
      >
        <ExpressCheckoutElement
          options={{ buttonHeight: 46 }}
          onConfirm={() => confirm(true)}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="text-[11px] text-[var(--color-ink-tertiary)]">{t.pay.expressOr}</span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      {/* ---------- Card / other methods ---------- */}
      <PaymentElement options={{ layout: "tabs" }} />

      {/* ---------- Legal confirmations ---------- */}
      <div className="flex flex-col gap-2.5">
        {[
          {
            checked: acceptedTerms,
            set: setAcceptedTerms,
            node: legalLine(t.pay.terms, {
              terms: { label: t.pay.termsLink, href: "/terms" },
              privacy: { label: t.pay.privacyLink, href: "/privacy" },
            }),
          },
          {
            checked: acceptedWithdrawal,
            set: setAcceptedWithdrawal,
            node: legalLine(t.pay.withdrawal, {
              withdrawal: { label: t.pay.withdrawalLink, href: "/withdrawal" },
            }),
          },
        ].map((row, i) => (
          <label
            key={i}
            className="flex cursor-pointer items-start gap-2.5 text-[11.5px] leading-relaxed text-[var(--color-ink-secondary)]"
          >
            <input
              type="checkbox"
              checked={row.checked}
              onChange={(e) => row.set(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
            />
            <span>{row.node}</span>
          </label>
        ))}

        {showConsentHint ? (
          <p className="flex items-center gap-1.5 text-[11px] text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" /> {t.pay.mustAccept}
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3 text-[12px] leading-relaxed text-red-300"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {/* ---------- The legally mandated order button ---------- */}
      <button
        type="button"
        onClick={() => confirm(false)}
        disabled={busy || !stripe || phase === "done"}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[15px] font-semibold transition-all duration-200",
          "bg-accent text-[var(--color-accent-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_24px_-8px_rgba(149,191,71,0.55)]",
          "hover:bg-accent-bright active:scale-[0.99]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {phase === "paying" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t.pay.processing}
          </>
        ) : phase === "confirming" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t.pay.confirming}
          </>
        ) : phase === "done" ? (
          t.pay.succeeded
        ) : (
          <>
            <Lock className="h-4 w-4" /> {t.pay.orderButton}
          </>
        )}
      </button>

      <PaymentIcons />

      <p className="flex items-center justify-center gap-1.5 text-center t-caption leading-relaxed text-[var(--color-ink-tertiary)]">
        <ShieldCheck className="h-3 w-3 shrink-0 text-accent" />
        {t.pay.securedBy}
      </p>
    </div>
  );
}
