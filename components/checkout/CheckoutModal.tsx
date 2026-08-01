"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, CreditCard, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PRODUCT } from "@/lib/pricing";

/**
 * Checkout modal.
 *
 * ⚠️ MOCK — no payment is taken and no card data is handled here. Before
 * launch, replace `submit()` with a real Stripe Checkout redirect:
 * create the session server-side, redirect the user to Stripe's own hosted
 * page, and unlock ONLY after a webhook confirms payment. Never collect card
 * numbers in your own DOM, and never trust a client-side unlock flag.
 *
 * The card fields below are disabled placeholders on purpose — they look
 * like a checkout without pretending to accept real card details.
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
    // Stand-in for the Stripe round-trip.
    await new Promise((r) => setTimeout(r, 1400));
    onSuccess(email);
  };

  // Deliberately NOT wrapped in <AnimatePresence>. An exit animation here
  // leaves the full-screen backdrop mounted at opacity 0 if presence
  // bookkeeping stalls, and an invisible overlay swallows every click on the
  // dashboard underneath. A hard unmount cannot fail that way; losing the
  // fade-out is a fair trade.
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/80 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close checkout"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="glass-deep relative my-auto w-full max-w-md rounded-3xl p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              One-time unlock
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {PRODUCT.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close checkout"
            className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-baseline gap-2 border-y border-white/10 py-5">
          <span className="font-mono-terminal text-4xl font-semibold tabular-nums">
            {PRODUCT.price} {PRODUCT.currency}
          </span>
          <span className="text-xs text-zinc-500">once · no subscription</span>
        </div>

        <ul className="mt-5 flex flex-col gap-2.5">
          {PRODUCT.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2.5 text-sm text-zinc-300"
            >
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
            placeholder="Email for your receipt"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm outline-none transition-colors placeholder:text-zinc-600 focus:border-accent/60"
          />

          {/* Disabled placeholder — real card entry belongs on Stripe's
                  hosted page, never in our own DOM. */}
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-3.5 text-sm text-zinc-600">
            <CreditCard className="h-4 w-4" />
            <span>Card details are entered on the payment page</span>
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-1 w-full"
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processing…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" /> Pay {PRODUCT.price}{" "}
                {PRODUCT.currency} & unlock
              </>
            )}
          </Button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Encrypted
            checkout
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-accent" /> Card data never touches
            our servers
          </span>
        </div>

        <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-300/90">
          Development build — this is a checkout mock. No payment is taken and
          no card details are collected. Wire Stripe before launch.
        </p>
      </motion.div>
    </div>
  );
}
