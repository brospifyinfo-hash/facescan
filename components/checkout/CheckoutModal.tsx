"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { StripeCheckout } from "./StripeCheckout";
import { PaymentIcons } from "./PaymentIcons";
import { Logo } from "@/components/ui/Logo";
import { useI18n, useT } from "@/lib/i18n";
import { formatPrice, PLAN_ORDER, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/cn";

/**
 * Two steps: pick a plan, then pay.
 *
 * Splitting them matters for Stripe — Elements binds to one PaymentIntent at
 * mount and the amount cannot change underneath it, so the plan has to be
 * settled before the payment tree exists.
 *
 * WHAT THE REDESIGN IS ACTUALLY FOR. The old sheet listed three plans as
 * three equal boxes of small text, and the only thing separating them was a
 * number. Nobody chooses that way. Now the tier is legible at a glance: the
 * price is the largest thing on the card, what you get is a short list of
 * ticks, what you do NOT get is struck through rather than omitted, and the
 * selected card is unmistakably selected. The reassurance that used to be
 * buried at the payment step — encrypted, one-off, instant — sits where the
 * decision is made instead.
 *
 * The "most complete" badge moved from `pro` to `blueprint`. It says "most
 * complete" in all four languages and was sitting on the middle tier, which
 * made it a claim the plan could not support.
 */
export function CheckoutModal({
  open,
  onClose,
  onSuccess,
  initialPlan = "pro",
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (plan: PlanId) => void;
  initialPlan?: PlanId;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [step, setStep] = useState<"plan" | "pay">("plan");

  useEffect(() => {
    if (!open) return;
    setPlan(initialPlan);
    setStep("plan");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, initialPlan]);

  // Deliberately NOT wrapped in <AnimatePresence>: a stalled exit animation
  // leaves the backdrop mounted at opacity 0 and swallows every click on the
  // page underneath. A hard unmount cannot fail that way.
  if (!open) return null;

  const reassurance = [
    { icon: ShieldCheck, text: t.checkout.secure },
    { icon: Zap, text: t.checkout.instant },
    { icon: Lock, text: t.checkout.once },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-lg sm:items-center">
      <button
        type="button"
        aria-label={t.checkout.close}
        tabIndex={-1}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={t.checkout.choosePlan}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative my-auto w-full max-w-[440px] overflow-hidden rounded-[28px]"
      >
        {/* ---------- Header ---------- */}
        <header className="relative px-6 pt-6 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Logo height={24} />
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                {t.checkout.eyebrow}
              </p>
              <h2 className="mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-ink)]">
                {step === "plan" ? t.checkout.choosePlan : t.plans[plan].name}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label={t.checkout.close}
              className="interactive -mr-1 shrink-0 rounded-full border border-white/[0.12] bg-white/[0.05] p-2 text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* The step rail. Two segments, and the second only fills once it is
              actually reached — a progress bar that is already half full on
              arrival tells you nothing. */}
          <ol className="mt-5 flex items-center gap-2">
            {(["plan", "pay"] as const).map((id, i) => {
              const done = step === "pay" && id === "plan";
              const active = step === id;
              return (
                <li key={id} className="flex flex-1 items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      done
                        ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                        : active
                          ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                          : "border border-white/[0.14] text-[var(--color-ink-quaternary)]",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[11.5px] font-medium",
                      active || done
                        ? "text-[var(--color-ink)]"
                        : "text-[var(--color-ink-quaternary)]",
                    )}
                  >
                    {id === "plan" ? t.checkout.stepPlan : t.checkout.stepPay}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "h-px flex-1 rounded-full",
                      done ? "bg-[var(--color-accent)]/50" : "bg-white/[0.10]",
                    )}
                  />
                </li>
              );
            })}
          </ol>
        </header>

        {step === "plan" ? (
          <div className="px-6 pb-6 pt-5 sm:px-7">
            <div className="flex flex-col gap-3">
              {PLAN_ORDER.map((id) => {
                const active = plan === id;
                const copy = t.plans[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlan(id)}
                    aria-pressed={active}
                    className={cn(
                      "interactive relative rounded-[20px] border p-4 text-left transition-colors duration-200",
                      active
                        ? "border-[var(--color-accent)]/70 bg-[var(--color-accent)]/[0.09] shadow-[0_0_0_1px_var(--color-accent),0_12px_32px_-16px_rgba(95,227,138,0.6)]"
                        : "border-white/[0.10] bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    {/* The badge belongs to the tier that actually is the most
                        complete one, which is the top one. */}
                    {id === "blueprint" ? (
                      <span className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-accent-ink)]">
                        <Sparkles className="h-2.5 w-2.5" aria-hidden />
                        {t.checkout.popular}
                      </span>
                    ) : null}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
                              active
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                                : "border-white/25",
                            )}
                          >
                            {active ? (
                              <Check className="h-3 w-3 text-[var(--color-accent-ink)]" />
                            ) : null}
                          </span>
                          <span className="text-[15.5px] font-bold text-[var(--color-ink)]">
                            {copy.name}
                          </span>
                        </span>
                        <p className="mt-1 pl-[26px] text-[11.5px] leading-snug text-[var(--color-ink-tertiary)]">
                          {copy.tagline}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={cn(
                            "block text-[22px] font-bold leading-none tracking-tight tabular-nums",
                            active ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]",
                          )}
                        >
                          {formatPrice(locale, id)}
                        </span>
                        <span className="mt-1 block text-[9.5px] text-[var(--color-ink-quaternary)]">
                          {t.checkout.once}
                        </span>
                      </div>
                    </div>

                    <ul className="mt-3.5 flex flex-col gap-1.5 pl-[26px]">
                      {copy.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-[12px] leading-snug text-[var(--color-ink-secondary)]"
                        >
                          <Check
                            className={cn(
                              "mt-[3px] h-3 w-3 shrink-0",
                              active
                                ? "text-[var(--color-accent)]"
                                : "text-[var(--color-ink-tertiary)]",
                            )}
                            aria-hidden
                          />
                          {f}
                        </li>
                      ))}
                      {/* Shown rather than omitted: a plan you can see the
                          edges of is one you can actually choose between. */}
                      {copy.excluded.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-[12px] leading-snug text-[var(--color-ink-quaternary)]"
                        >
                          <X className="mt-[3px] h-3 w-3 shrink-0" aria-hidden />
                          <span className="line-through decoration-white/25">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setStep("pay")}
              className="interactive mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] py-3.5 text-[14px] font-bold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)]"
            >
              {t.checkout.continueToPayment}
              <span className="tabular-nums">· {formatPrice(locale, plan)}</span>
            </button>

            <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {reassurance.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-1.5 text-[10.5px] text-[var(--color-ink-tertiary)]"
                >
                  <Icon className="h-3 w-3 text-[var(--color-accent)]" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>

            {/* How you can pay is part of deciding whether to buy at all, so
                the marks sit here and not only at the payment step. */}
            <div className="mt-4 flex justify-center">
              <PaymentIcons className="justify-center" />
            </div>
          </div>
        ) : (
          <div className="px-6 pb-6 pt-5 sm:px-7">
            <StripeCheckout
              plan={plan}
              onBack={() => setStep("plan")}
              onPaid={(granted) => onSuccess(granted)}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
