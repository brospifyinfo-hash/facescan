// Deterministic action plan derived from the real scan metrics + quiz
// answers. Same scan → same plan, every render. No randomness.
//
// Returns PLAN IDS and weights only — the prose lives in lib/i18n so the
// plan translates with the rest of the page.

import type { PlanId } from "./metrics";
import { bmiOf, type QuizAnswers, type ScanMetrics } from "./store";

export interface PlanEntry {
  id: PlanId;
  emoji: string;
  weight: number;
}

export const PLAN_EMOJI: Record<PlanId, string> = {
  bodyFat: "🔥",
  guaSha: "🪨",
  tonguePosture: "👅",
  retinoid: "🧴",
  spf: "☀️",
  asymmetry: "⚖️",
  depuff: "👁️",
  proportions: "📐",
  hair: "💇",
  grooming: "✂️",
  sleep: "😴",
  smoking: "🚭",
  training: "🏋️",
};

export function buildPlan(quiz: QuizAnswers, m: ScanMetrics): PlanEntry[] {
  const out: PlanEntry[] = [];
  const add = (id: PlanId, weight: number) =>
    out.push({ id, emoji: PLAN_EMOJI[id], weight });

  const scoreOf = (id: string) =>
    m.metrics.find((x) => x.id === id)?.score ?? 100;

  // Height and weight give a reading even when body fat was skipped or
  // guessed — BMI is crude, but it beats an unanswered question.
  const bmi = bmiOf(quiz);
  const highBodyFat =
    quiz.bodyFat === "19-25" ||
    quiz.bodyFat === "over25" ||
    (quiz.bodyFat !== "under12" && quiz.bodyFat !== "12-18" && bmi !== null && bmi >= 26);

  // Jaw & lower third
  if (highBodyFat) add("bodyFat", 100 - m.jawScore + 30);
  if (highBodyFat && (quiz.training === "none" || quiz.training === "1-2")) {
    add("training", 100 - m.jawScore + 12);
  }

  // Lifestyle levers that show in the face
  if (quiz.smoking === "daily") add("smoking", 88);
  else if (quiz.smoking === "occasionally") add("smoking", 62);

  if (m.jawScore < 78 || quiz.insecurity === "jawline") {
    add("guaSha", 100 - m.jawScore);
    if (quiz.mewing !== "daily") add("tonguePosture", 100 - m.jawScore - 6);
  }

  // Skin — landmarks can't grade skin, so this is the routine layer.
  add("retinoid", quiz.insecurity === "skin" ? 95 : quiz.skincare === "none" ? 76 : 60);
  add("spf", quiz.skincare === "advanced" ? 52 : 74);

  if (m.symmetry < 84) add("asymmetry", 100 - m.symmetry);

  if (scoreOf("eyeAspect") < 75 || scoreOf("browPosition") < 75) {
    add("depuff", 100 - m.eyesScore);
  }

  if (m.proportionsScore < 72) {
    add("proportions", 100 - m.proportionsScore - 10);
  }

  if (quiz.insecurity === "hair") add("hair", 92);

  add("grooming", quiz.goal === "model" ? 78 : 55);
  // Short sleep is a bigger lever than most products, so weight it by answer.
  add("sleep", quiz.sleep === "under6" ? 90 : quiz.sleep === "6-7" ? 68 : 46);

  return out.sort((a, b) => b.weight - a.weight).slice(0, 9);
}
