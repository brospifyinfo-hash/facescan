"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, CreditCard, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fill, useI18n, useT } from "@/lib/i18n";
import { formatPrice, PLAN_ORDER, type PlanId } from "@/lib/pricing";
import { cn } from "@/lib/cn";

/**
 * Checkout modal.
 *
 * ⚠️ MOCK — no payment is taken and no card data is handled here. Before
 * launch, replace `submit()` with a real Stripe Checkout redirect: create
 * the session server-side, redirect to Stripe's own hosted page, and unlock
 * ONLY after a webhook confirms payment. Never collect card numbers in your
 * own DOM, and never trust a client-side unlock flag.
 */
export function CheckoutModal({
  open,
  onClose,
  onSuccess,
  initialPlan = "complete",
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (email: string, plan: PlanId) => void;
  initialPlan?: PlanId;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setPending(false);
      return;
    }
    setPlan(initialPlan);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, initialPlan]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setPending(true);
    await new Promise((r) => setTimeout(r, 1300)); // stand-in for Stripe
    onSuccess(email, plan);
  };

  // Deliberately NOT wrapped in <AnimatePresence>: a stalled exit animation
  // leaves the backdrop mounted at opacity 0 and swallows every click on the
  // page underneath. A hard unmount cannot fail that way.
  if (!open) return null;

  const price = formatPrice(locale, plan);

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
              {t.checkout.choosePlan}
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
                {id === "complete" ? (
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
                  {/* What this plan does NOT include — struck through, so the
                      difference between the two is visible at a glance. */}
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

        <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.checkout.emailPlaceholder}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/50"
          />

          {/* Disabled placeholder — real card entry belongs on Stripe's
              hosted page, never in our own DOM. */}
          <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-white/10 px-4 py-3 text-[12px] text-zinc-600">
            <CreditCard className="h-3.5 w-3.5" />
            {t.checkout.cardNote}
          </div>

          <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t.checkout.processing}
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" /> {fill(t.checkout.pay, { price })}
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-accent" /> {t.checkout.secure}
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-accent" /> {t.checkout.noCardData}
          </span>
        </div>

        <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-[10px] leading-relaxed text-amber-300/90">
          {t.checkout.mockWarning}
        </p>
      </motion.div>
    </div>
  );
}
