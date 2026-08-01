"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, CreditCard, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fill, useT } from "@/lib/i18n";
import { PRODUCT } from "@/lib/pricing";

/**
 * Checkout modal.
 *
 * ⚠️ MOCK — no payment is taken and no card data is handled here. Before
 * launch, replace `submit()` with a real Stripe Checkout redirect: create
 * the session server-side, redirect the user to Stripe's own hosted page,
 * and unlock ONLY after a webhook confirms payment. Never collect card
 * numbers in your own DOM, and never trust a client-side unlock flag.
 */
export function CheckoutModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
}) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setPending(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setPending(true);
    await new Promise((r) => setTimeout(r, 1400)); // stand-in for Stripe
    onSuccess(email);
  };

  // Deliberately NOT wrapped in <AnimatePresence>. An exit animation here
  // leaves the full-screen backdrop mounted at opacity 0 if presence
  // bookkeeping stalls, and an invisible overlay swallows every click on the
  // dashboard underneath. A hard unmount cannot fail that way.
  if (!open) return null;

  const price = `${PRODUCT.price} ${PRODUCT.currency}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/70 p-4 backdrop-blur-md">
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
        aria-label={t.checkout.product}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong relative my-auto w-full max-w-md rounded-[30px] p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              {t.checkout.eyebrow}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {t.checkout.product}
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

        <div className="mt-6 flex items-baseline gap-2 border-y border-white/10 py-5">
          <span className="text-4xl font-semibold tracking-tight">{price}</span>
          <span className="text-xs text-zinc-500">{t.checkout.once}</span>
        </div>

        <ul className="mt-5 flex flex-col gap-2.5">
          {t.checkout.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {f}
            </li>
          ))}
        </ul>

        <form onSubmit={submit} className="mt-7 flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.checkout.emailPlaceholder}
            className="glass-subtle rounded-2xl px-5 py-3.5 text-sm outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/50"
          />

          {/* Disabled placeholder — real card entry belongs on Stripe's
              hosted page, never in our own DOM. */}
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-3.5 text-sm text-zinc-600">
            <CreditCard className="h-4 w-4" />
            <span>{t.checkout.cardNote}</span>
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

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" /> {t.checkout.secure}
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-accent" /> {t.checkout.noCardData}
          </span>
        </div>

        <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-300/90">
          {t.checkout.mockWarning}
        </p>
      </motion.div>
    </div>
  );
}
