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

  /**
   * The card has been charged. LATCHES — nothing sets it back to false.
   *
   * This is the guard against the worst bug this form can have. The
   * entitlement poll below gives up after about fourteen seconds, and it used
   * to reset phase to "idle" and busy to false when it did. The pay button is
   * disabled on exactly those two, so a customer whose webhook happened to be
   * slow got a live pay button back on a payment that had already gone
   * through — and pressing it charged them a second time.
   *
   * Stripe has the money the moment confirmPayment resolves without an error.
   * From that instant the only honest states are "waiting for confirmation"
   * and "done", and paying again must be impossible.
   */
  const [charged, setCharged] = useState(false);

  /** The intent Stripe just charged. The fallback below has nothing to ask
   *  about without it. */
  const [intentId, setIntentId] = useState<string | null>(null);

  /**
   * Whether any wallet is actually offered.
   *
   * ExpressCheckoutElement renders NOTHING when the browser has no wallet to
   * show — Apple Pay outside Safari, Google Pay without a saved card, either
   * of them before the domain is verified with Stripe. The element collapsing
   * to zero height is correct; what was wrong is that the "or pay by card"
   * divider under it stayed, so the payment step opened with an empty gap and
   * a separator dividing nothing from everything.
   *
   * null = not decided yet, so nothing flashes on the way in.
   */
  const [hasWallets, setHasWallets] = useState<boolean | null>(null);

  const consented = acceptedTerms && acceptedWithdrawal;

  /**
   * Turn the payment into an unlock, as fast as the truth allows.
   *
   * ASK STRIPE FIRST. Both routes below end at the same authority — the
   * webhook is Stripe PUSHING the fact, /api/stripe/confirm is the server
   * PULLING the same fact from Stripe and checking it against this
   * session. Waiting for the push was costing the customer ten to sixty
   * seconds of spinner: the webhook has to arrive AND write to the
   * spreadsheet (~2s per round trip) before a poll can see it, and each
   * poll is another spreadsheet read. Pulling costs one Stripe call and
   * one write.
   *
   * The poll stays as the fallback for the case the pull cannot answer —
   * Stripe unreachable from our side, or an id we never got back — because
   * a paid customer must never be left locked out.
   */
  const waitForEntitlement = useCallback(
    async (pi?: string | null) => {
      setPhase("confirming");
      const id = pi ?? intentId;

      if (id) {
        try {
          const res = await fetch("/api/stripe/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: id }),
          });
          const data = await res.json();
          if (res.ok && data.plan) {
            setPhase("done");
            onPaid(data.plan as PlanId);
            return;
          }
        } catch {
          /* fall through to the webhook path */
        }
      }

      // Fallback: wait for the push. Fewer, wider-spaced attempts than
      // before — this is now the unusual path, and every attempt is a
      // spreadsheet read.
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 900));
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
      }

      // Paid but not yet granted — say so honestly instead of failing
      // silently.
      //
      // busy and phase deliberately STAY where they are. Resetting them was
      // the double-charge bug: the pay button keys off both, so clearing
      // them handed back a live pay button on a card that had already been
      // charged. The way out of here is the "check again" control, which
      // re-runs this; there is no path that pays twice.
      setError(t.pay.errors.timeout);
    },
    [onPaid, t, intentId],
  );

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

    const { error: err, paymentIntent } = await stripe.confirmPayment({
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
    // Past this line the money has moved. Latch before polling, so even an
    // exception inside waitForEntitlement cannot leave a payable button.
    setCharged(true);
    setIntentId(paymentIntent?.id ?? null);
    await waitForEntitlement(paymentIntent?.id ?? null);
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
      {/* Kept mounted even when empty: the element has to run to tell us
          whether it has anything, so it is hidden rather than skipped. */}
      <div
        className={cn(
          "transition-opacity",
          hasWallets === false && "hidden",
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
          onReady={({ availablePaymentMethods }) =>
            setHasWallets(Boolean(availablePaymentMethods))
          }
          // A wallet that fails to load must not take the card form with it.
          onLoadError={() => setHasWallets(false)}
        />
      </div>

      <div className={cn("flex items-center gap-3", hasWallets !== true && "hidden")}>
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
        <div
          role="alert"
          className={cn(
            "rounded-xl border p-3 text-[12px] leading-relaxed",
            // Charged-but-unconfirmed is not a failure and must not be
            // coloured like one: the money arrived, only the confirmation is
            // late. Red here would tell a paying customer their payment
            // failed, which is the opposite of what happened.
            charged
              ? "border-amber-500/25 bg-amber-500/[0.07] text-amber-200"
              : "border-red-500/25 bg-red-500/[0.07] text-red-300",
          )}
        >
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
          {charged ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                void waitForEntitlement();
              }}
              className="mt-2.5 rounded-full border border-amber-400/40 px-3 py-1.5 text-[11.5px] font-semibold text-amber-200 hover:bg-amber-400/10"
            >
              {t.pay.checkAgain}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ---------- The legally mandated order button ---------- */}
      <button
        type="button"
        onClick={() => confirm(false)}
        disabled={busy || charged || !stripe || phase === "done"}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[15px] font-semibold transition-all duration-200",
          "bg-accent text-[var(--color-accent-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_24px_-8px_rgba(95,227,138,0.55)]",
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
