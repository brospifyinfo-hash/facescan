"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Lock, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { StripeCheckout } from "./StripeCheckout";
import { PaymentIcons } from "./PaymentIcons";
import { Logo } from "@/components/ui/Logo";
import { useI18n, useT } from "@/lib/i18n";
import {
  PLAN_ORDER,
  SCAN_QUOTA,
  can,
  formatPrice,
  unlockCount,
  upgradeCost,
  type PlanId,
} from "@/lib/pricing";
import { cn } from "@/lib/cn";

/**
 * Two steps: pick a plan, then pay.
 *
 * Splitting them matters for Stripe — Elements binds to one PaymentIntent at
 * mount and the amount cannot change underneath it, so the plan has to be
 * settled before the payment tree exists.
 *
 * WHY THE PLAN STEP LOOKS LIKE THIS
 * ---------------------------------
 * The brief was to make people more likely to buy. The previous sheet showed
 * all three plans fully expanded at once: three feature lists plus three
 * struck-through exclusion lists, about twenty lines of small text before the
 * button. That is not a choice, it is a reading task, and a reading task at
 * the moment of payment is where people leave.
 *
 * Four changes, each doing one job:
 *
 *   ONLY THE SELECTED PLAN OPENS. Collapsed rows carry a name, one line, a
 *   price and a count. The detail appears for the plan actually under
 *   consideration, so the sheet is scannable in seconds instead of read.
 *
 *   THE EXCLUSIONS LEFT THE CARDS. They were repeated on every tier, which
 *   made the whole sheet read as a list of things you do not get. There is
 *   now ONE line, for the selected plan, directly above the button — the
 *   moment where knowing what you are giving up actually changes the
 *   decision.
 *
 *   AN UPGRADE ROW PRICES THE DIFFERENCE. "For 13,00 € more" is a smaller
 *   number to weigh than 18,95 €, it is one tap, and it is plain arithmetic
 *   on the two prices already on screen (see upgradeCost).
 *
 *   THE BUTTON SAYS WHAT HAPPENS. "Unlock now · 18,95 €" rather than
 *   "continue to payment": the outcome, not the next form. It is sticky, so
 *   on a phone it never scrolls out of reach.
 *
 * NOTHING HERE IS INVENTED. No countdown, no customer counter, no crossed-out
 * former price, no "only 3 left". Every number on this sheet — the prices,
 * the difference, the unlock counts, the included scans — is read from
 * lib/pricing.ts, which is the same table the charge comes from. This product
 * has honest things to sell with; it does not need the other kind.
 *
 * The "most complete" badge sits on `blueprint`, which is the tier that
 * actually is the most complete one.
 */
export function CheckoutModal({
  open,
  onClose,
  onSuccess,
  initialPlan = "blueprint",
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

  // OPENING resets the sheet. Nothing else may.
  //
  // This used to be one effect together with the Escape listener below, and
  // therefore carried `onClose` in its dependency array. `onClose` is an
  // inline arrow at every call site, so it is a NEW function on every render
  // of the parent — which made this effect re-run on every parent render and
  // throw away both pieces of state it owns.
  //
  // Two bugs came out of that, and they were the two that got reported:
  //
  //   THE PICKED PLAN JUMPED BACK. Selecting the 1,95 € tier re-rendered the
  //   results page, this effect fired, `plan` went back to `initialPlan` —
  //   and the button under a selected 1,95 € card charged 18,95 €.
  //
  //   PRESSING PAY RETURNED TO THE PLAN STEP. confirm() opens with
  //   setPaying(true) (lib/store.ts) and the results page subscribes to that
  //   store, so the first thing the buy button did was re-render the parent,
  //   re-run this effect and setStep("plan") — tearing down Elements and the
  //   half-submitted payment with it.
  //
  // Splitting them fixes both: the reset now depends only on the things that
  // mean "a new checkout has begun", and the listener may re-bind as often
  // as it likes without touching state.
  useEffect(() => {
    if (!open) return;
    setPlan(initialPlan);
    setStep("plan");
  }, [open, initialPlan]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Deliberately NOT wrapped in <AnimatePresence>: a stalled exit animation
  // leaves the backdrop mounted at opacity 0 and swallows every click on the
  // page underneath. A hard unmount cannot fail that way.
  if (!open) return null;

  const reassurance = [
    { icon: ShieldCheck, text: t.checkout.secure },
    { icon: Zap, text: t.checkout.instant },
    { icon: Lock, text: t.checkout.once },
  ];

  const topPlan = PLAN_ORDER[PLAN_ORDER.length - 1];
  const selected = t.plans[plan];
  const delta = upgradeCost(locale, plan);

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
        className="glass-strong relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-[440px] scroll-slim overflow-y-auto overscroll-contain rounded-[28px]"
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
                {step === "plan" ? t.checkout.choosePlan : selected.name}
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
                      done || active
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
          <div className="px-6 pt-5 sm:px-7">
            <div className="flex flex-col gap-2.5">
              {PLAN_ORDER.map((id) => {
                const active = plan === id;
                const copy = t.plans[id];
                // A purchase includes FURTHER scans (lib/history/quota.ts),
                // and only the tiers that come with a history have anywhere
                // to put them — so the line is shown where it is true and
                // omitted where it would be a technicality.
                const scans = can(id, "history") ? SCAN_QUOTA[id] : 0;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPlan(id)}
                    aria-pressed={active}
                    className={cn(
                      "interactive relative rounded-[20px] border px-4 py-3.5 text-left transition-colors duration-200",
                      active
                        ? "border-[var(--color-accent)]/70 bg-[var(--color-accent)]/[0.09] shadow-[0_0_0_1px_var(--color-accent),0_12px_32px_-16px_rgba(95,227,138,0.6)]"
                        : "border-white/[0.10] bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    {id === topPlan ? (
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

                    {/* The count is what a collapsed row trades its feature
                        list for: still comparable at a glance, one line
                        instead of seven. */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[26px]">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                          active
                            ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                            : "bg-white/[0.06] text-[var(--color-ink-tertiary)]",
                        )}
                      >
                        {t.checkout.unlocksCount.replace(
                          "{n}",
                          String(unlockCount(id)),
                        )}
                      </span>
                      {scans > 0 ? (
                        <span className="text-[10.5px] tabular-nums text-[var(--color-ink-tertiary)]">
                          {scans === 1
                            ? t.checkout.oneMoreScan
                            : t.checkout.moreScans.replace("{n}", String(scans))}
                        </span>
                      ) : null}
                    </div>

                    {/* Opens for the plan under consideration only. No exit
                        animation — see the AnimatePresence note above; the
                        same failure mode applies to anything that can stall
                        while mounted. */}
                    {active ? (
                      <motion.ul
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="mt-3 flex flex-col gap-1.5 border-t border-white/[0.08] pl-[26px] pt-3"
                      >
                        {copy.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-2 text-[12px] leading-snug text-[var(--color-ink-secondary)]"
                          >
                            <Check
                              className="mt-[3px] h-3 w-3 shrink-0 text-[var(--color-accent)]"
                              aria-hidden
                            />
                            {f}
                          </li>
                        ))}
                      </motion.ul>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* ---------- The upgrade row ----------
                Only when there is something above the current pick. It prices
                the gap rather than the tier, which is the smaller and more
                answerable question, and it is one tap. */}
            {delta ? (
              <button
                type="button"
                onClick={() => setPlan(topPlan)}
                className="interactive mt-3 flex w-full items-start gap-3 rounded-[18px] border border-dashed border-[var(--color-accent)]/40 bg-[var(--color-accent)]/[0.05] px-4 py-3 text-left hover:border-[var(--color-accent)]/70"
              >
                <ArrowUpRight
                  className="mt-[2px] h-4 w-4 shrink-0 text-[var(--color-accent)]"
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-[var(--color-ink)]">
                    {t.checkout.upgradeTitle.replace("{price}", delta)}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-ink-tertiary)]">
                    {t.checkout.upgradeSub}
                  </span>
                </span>
              </button>
            ) : null}

            {/* ---------- What the pick costs you ----------
                One line, for the selected plan only, right where it changes
                the decision. The top tier has no exclusions, so the row
                disappears entirely rather than rendering an empty label. */}
            {selected.excluded.length ? (
              <p className="mt-3 text-[11px] leading-snug text-[var(--color-ink-quaternary)]">
                <span className="font-semibold text-[var(--color-ink-tertiary)]">
                  {t.checkout.notIncluded}:
                </span>{" "}
                {selected.excluded.join(" · ")}
              </p>
            ) : null}

            {/* How you can pay is part of deciding whether to buy at all, so
                the marks sit at the decision and not only at the payment
                step. Above the pinned bar rather than inside it: they inform
                the choice once, and pinning them would cost a third of a
                phone screen for something nobody re-reads. */}
            <div className="mt-4 flex justify-center">
              <PaymentIcons className="justify-center" />
            </div>

            {/* ---------- Commit ----------
                Sticky: the sheet scrolls on a phone, and a button that
                scrolls away is a button that does not get pressed.
                OPAQUE, not a gradient — a translucent bar let the feature
                list read straight through the button underneath it, which
                looked like a rendering fault rather than a layer. */}
            <div className="sticky bottom-0 -mx-6 mt-5 border-t border-white/[0.08] bg-[rgba(9,12,17,0.97)] px-6 pb-6 pt-4 backdrop-blur-xl sm:-mx-7 sm:px-7">
              <button
                type="button"
                onClick={() => setStep("pay")}
                className="interactive flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] py-3.5 text-[14px] font-bold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)]"
              >
                {t.checkout.unlockNow}
                <span className="tabular-nums">· {formatPrice(locale, plan)}</span>
              </button>

              <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
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
