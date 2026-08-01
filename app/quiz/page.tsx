"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { fill, useT } from "@/lib/i18n";
import { QUIZ_FIELDS, QUIZ_KEYS, useFunnel } from "@/lib/store";
import { cn } from "@/lib/cn";

export default function QuizPage() {
  const router = useRouter();
  const t = useT();
  const { quiz, setAnswer } = useFunnel();
  const [step, setStep] = useState(0);
  const [minorGate, setMinorGate] = useState(false);

  const question = t.quiz.questions[step];
  const field = QUIZ_FIELDS[step];
  const keys = QUIZ_KEYS[step];
  const progress = (step / t.quiz.questions.length) * 100;

  const select = (index: number) => {
    const key = keys[index];
    setAnswer(field, key);

    // Facial-aesthetics scoring for minors is both ethically off-limits and
    // technically meaningless (facial structure is still developing).
    if (field === "age" && key === "under18") {
      setMinorGate(true);
      return;
    }

    setTimeout(() => {
      if (step + 1 < t.quiz.questions.length) setStep(step + 1);
      else router.push("/upload");
    }, 240);
  };

  if (minorGate) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="glass-strong w-full max-w-md rounded-[30px] p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {t.quiz.minorTitle}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            {t.quiz.minorBody}
          </p>
          <Link href="/" className="mt-8 inline-block">
            <Button variant="outline">{t.quiz.minorCta}</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <div className="fixed inset-x-0 top-0 z-10 h-1 bg-white/5">
        <motion.div
          className="h-full bg-accent"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-xl justify-end px-6 pt-6">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-16">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          {fill(t.quiz.progress, { n: step + 1, total: t.quiz.questions.length })}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {question.title}
            </h1>
            {question.sub ? (
              <p className="mt-2 text-sm text-zinc-500">{question.sub}</p>
            ) : null}

            <div className="mt-10 flex flex-col gap-3">
              {question.options.map((option, i) => {
                const active = quiz[field] === keys[i];
                return (
                  <button
                    key={option}
                    onClick={() => select(i)}
                    className={cn(
                      "glass glass-interactive rounded-2xl px-6 py-4 text-left text-sm font-medium",
                      active && "border-accent/50 bg-accent/10 text-accent",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-12">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" /> {t.quiz.back}
            </button>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" /> {t.quiz.home}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
