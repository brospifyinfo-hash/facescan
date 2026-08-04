"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StripeCheckout } from "./StripeCheckout";
import { useI18n, useT } from "@/lib/i18n";
import { formatPrice, PLAN_ORDER, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/cn";

/**
 * Two steps: pick a plan, then pay.
 *
 * Splitting them matters for Stripe — Elements binds to one PaymentIntent
 * at mount and the amount can't change underneath it, so the plan has to be
 * settled before the payment tree exists.
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/75 p-4 backdrop-blur-md">
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
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative my-auto w-full max-w-md rounded-[26px] p-6 sm:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono-terminal text-[10px] uppercase tracking-[0.2em] text-accent">
              {t.checkout.eyebrow}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {step === "plan" ? t.checkout.choosePlan : t.plans[plan].name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t.checkout.close}
            className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "plan" ? (
          <>
            <div className="mt-5 flex flex-col gap-2.5">
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
                      "relative rounded-2xl border p-4 text-left transition-all duration-200",
                      active
                        ? "border-accent/60 bg-accent/[0.07]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20",
                    )}
                  >
                    {id === "pro" ? (
                      <span className="absolute -top-2 right-4 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-950">
                        {t.checkout.popular}
                      </span>
                    ) : null}

                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-semibold text-zinc-50">
                        {copy.name}
                      </span>
                      <span
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          active ? "text-accent" : "text-zinc-300",
                        )}
                      >
                        {formatPrice(locale, id)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{copy.tagline}</p>

                    <ul className="mt-3 flex flex-col gap-1.5">
                      {copy.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-[12px] leading-snug text-zinc-400"
                        >
                          <Check
                            className={cn(
                              "mt-0.5 h-3.5 w-3.5 shrink-0",
                              active ? "text-accent" : "text-zinc-600",
                            )}
                          />
                          {f}
                        </li>
                      ))}
                      {/* What this plan does NOT include. */}
                      {copy.excluded.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-[12px] leading-snug text-zinc-600"
                        >
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-700" />
                          <span className="line-through decoration-zinc-700">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <Button size="lg" className="mt-5 w-full" onClick={() => setStep("pay")}>
              {t.checkout.continueToPayment} · {formatPrice(locale, plan)}
            </Button>
          </>
        ) : (
          <div className="mt-5">
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
