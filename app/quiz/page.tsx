"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFunnel, type QuizAnswers } from "@/lib/store";
import { cn } from "@/lib/cn";

interface Question {
  key: keyof QuizAnswers;
  title: string;
  sub?: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    key: "gender",
    title: "How should we calibrate your scan?",
    sub: "Facial reference ranges differ — this sets the right baseline.",
    options: ["Male", "Female"],
  },
  {
    key: "age",
    title: "How old are you?",
    options: ["Under 18", "18–24", "25–34", "35+"],
  },
  {
    key: "insecurity",
    title: "What bothers you most about your face?",
    options: [
      "Asymmetry",
      "Weak jawline",
      "Eye area",
      "Skin quality",
      "Thinning hair",
    ],
  },
  {
    key: "bodyFat",
    title: "Estimated body-fat percentage?",
    sub: "Facial definition correlates strongly with body fat.",
    options: ["Under 12%", "12–18%", "19–25%", "Over 25%", "Not sure"],
  },
  {
    key: "mewing",
    title: "Do you practice tongue posture (mewing)?",
    options: ["Never", "Sometimes", "Every day"],
  },
  {
    key: "goal",
    title: "What's your ultimate goal?",
    options: [
      "Model-tier looks",
      "Dating confidence",
      "General self-improvement",
      "Just curious",
    ],
  },
];

export default function QuizPage() {
  const router = useRouter();
  const { quiz, setAnswer } = useFunnel();
  const [step, setStep] = useState(0);
  const [minorGate, setMinorGate] = useState(false);

  const question = QUESTIONS[step];
  const progress = (step / QUESTIONS.length) * 100;

  const select = (value: string) => {
    setAnswer(question.key, value);

    // Facial-aesthetics scoring for minors is both ethically off-limits and
    // technically meaningless (facial structure is still developing).
    if (question.key === "age" && value === "Under 18") {
      setMinorGate(true);
      return;
    }

    setTimeout(() => {
      if (step + 1 < QUESTIONS.length) setStep(step + 1);
      else router.push("/upload");
    }, 250);
  };

  if (minorGate) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="glass-deep w-full max-w-md rounded-3xl p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-6 text-2xl font-semibold">FaceScan is 18+</h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Your facial structure is still changing — any score we gave you
            today would be wrong within a year, and we don&apos;t analyze
            minors&apos; faces on principle. Come back when you&apos;re 18.
          </p>
          <Link href="/" className="mt-8 inline-block">
            <Button variant="outline">Back to start</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col">
      {/* Progress bar */}
      <div className="fixed inset-x-0 top-0 z-10 h-1 bg-white/5">
        <motion.div
          className="h-full bg-accent"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Question {step + 1} of {QUESTIONS.length}
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
              {question.options.map((option) => {
                const active = quiz[question.key] === option;
                return (
                  <button
                    key={option}
                    onClick={() => select(option)}
                    className={cn(
                      "glass rounded-2xl px-6 py-4 text-left text-sm font-medium transition-all",
                      active
                        ? "border-accent/60 bg-accent/10 text-accent"
                        : "hover:border-white/25 hover:bg-white/[0.06]",
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
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
