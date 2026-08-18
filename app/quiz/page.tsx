"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { fill, useT } from "@/lib/i18n";
import { QUIZ_STEPS, useFunnel } from "@/lib/store";
import { cn } from "@/lib/cn";

export default function QuizPage() {
  const router = useRouter();
  const t = useT();
  const { quiz, setAnswer } = useFunnel();
  const [step, setStep] = useState(0);
  const [minorGate, setMinorGate] = useState(false);

  const spec = QUIZ_STEPS[step];
  const copy = t.quiz.questions[step];
  const total = QUIZ_STEPS.length;
  const progress = (step / total) * 100;

  const advance = () => {
    if (step + 1 < total) setStep(step + 1);
    else router.push("/upload");
  };

  const choose = (index: number) => {
    if (spec.kind !== "choice") return;
    const key = spec.keys[index];
    setAnswer(spec.field, key);

    // Facial-aesthetics scoring for minors is both ethically off-limits and
    // technically meaningless — the structure is still developing.
    if (spec.field === "age" && key === "under18") {
      setMinorGate(true);
      return;
    }
    setTimeout(advance, 200);
  };

  if (minorGate) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="surface-raised w-full max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-accent" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {t.quiz.minorTitle}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
            {t.quiz.minorBody}
          </p>
          <Link href="/" className="mt-8 inline-block">
            <Button variant="outline">{t.quiz.minorCta}</Button>
          </Link>
        </div>
      </main>
    );
  }

  const numberValue =
    spec.kind === "number"
      ? ((quiz[spec.field] as number | undefined) ?? spec.preset)
      : 0;

  return (
    <main className="flex min-h-dvh flex-col lg:justify-center">
      <div className="fixed inset-x-0 top-0 z-10 h-[3px] bg-white/[0.06]">
        <motion.div
          className="h-full bg-accent"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-xl justify-end px-6 pt-6 lg:max-w-2xl">
        <LanguageSwitcher />
      </div>

      {/* On a phone the question floats directly on the colour fields — that
          look stays exactly as it is. From lg the same question sits on a
          glass pane, so the desktop gets the widget material without taking
          the background away: the pane is mostly the background, refracted. */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16 lg:max-w-2xl lg:rounded-[var(--r-window)] lg:border lg:border-white/[0.14] lg:bg-white/[0.035] lg:p-12 lg:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16),0_28px_72px_-28px_rgba(0,0,0,0.9)] lg:backdrop-blur-3xl lg:backdrop-saturate-200 lg:my-10 lg:flex-none">
        <p className="font-mono-terminal text-[11px] text-[var(--color-ink-tertiary)]">
          {fill(t.quiz.progress, { n: step + 1, total })}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">
              {copy.title}
            </h1>
            {copy.sub ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-ink-tertiary)]">
                {copy.sub}
              </p>
            ) : null}

            {spec.kind === "choice" ? (
              <div className="mt-8 flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-2.5">
                {(copy.options ?? []).map((option, i) => {
                  const active = quiz[spec.field] === spec.keys[i];
                  return (
                    <button
                      key={option}
                      onClick={() => choose(i)}
                      className={cn(
                        "group flex items-center justify-between rounded-2xl border px-5 py-4 text-left text-[14px] font-medium transition-all duration-200",
                        active
                          ? "border-accent/60 bg-accent/[0.09] text-accent"
                          : "border-white/[0.08] bg-white/[0.02] text-[var(--color-ink)] hover:border-white/20 hover:bg-white/[0.05]",
                      )}
                    >
                      {option}
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-colors",
                          active ? "bg-accent" : "bg-white/10 group-hover:bg-white/25",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-8">
                <div className="flex items-end justify-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={spec.min}
                    max={spec.max}
                    value={numberValue}
                    onChange={(e) =>
                      setAnswer(
                        spec.field,
                        Math.max(spec.min, Math.min(spec.max, Number(e.target.value) || spec.min)),
                      )
                    }
                    className="w-32 border-b border-white/15 bg-transparent pb-1 text-center text-5xl font-semibold tabular-nums outline-none transition-colors focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label={copy.title}
                  />
                  <span className="pb-2 text-lg text-[var(--color-ink-tertiary)]">{spec.unit}</span>
                </div>

                <input
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={numberValue}
                  onChange={(e) => setAnswer(spec.field, Number(e.target.value))}
                  className="mt-7 w-full accent-[var(--color-accent)]"
                  aria-label={copy.title}
                />
                <div className="mt-1 flex justify-between font-mono-terminal t-caption tabular-nums text-[var(--color-ink-tertiary)]">
                  <span>
                    {spec.min} {spec.unit}
                  </span>
                  <span>{t.quiz.numberHint}</span>
                  <span>
                    {spec.max} {spec.unit}
                  </span>
                </div>

                <Button size="lg" className="mt-8 w-full" onClick={advance}>
                  {t.quiz.next} <ArrowRight className="h-4 w-4" />
                </Button>
                <button
                  onClick={advance}
                  className="mt-3 w-full text-center text-[12px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink-secondary)]"
                >
                  {t.quiz.skip}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 text-[13px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t.quiz.back}
            </button>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[13px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t.quiz.home}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
