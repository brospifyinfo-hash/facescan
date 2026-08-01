// Deterministic action plan derived from the real scan metrics + quiz
// answers. Same scan → same plan, every render. No randomness.
//
// Returns PLAN IDS and weights only — the prose lives in lib/i18n so the
// plan translates with the rest of the page.

import type { PlanId } from "./metrics";
import type { QuizAnswers, ScanMetrics } from "./store";

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
};

export function buildPlan(quiz: QuizAnswers, m: ScanMetrics): PlanEntry[] {
  const out: PlanEntry[] = [];
  const add = (id: PlanId, weight: number) =>
    out.push({ id, emoji: PLAN_EMOJI[id], weight });

  const scoreOf = (id: string) =>
    m.metrics.find((x) => x.id === id)?.score ?? 100;
  const highBodyFat = quiz.bodyFat === "19-25" || quiz.bodyFat === "over25";

  // Jaw & lower third
  if (highBodyFat) add("bodyFat", 100 - m.jawScore + 30);

  if (m.jawScore < 78 || quiz.insecurity === "jawline") {
    add("guaSha", 100 - m.jawScore);
    if (quiz.mewing !== "daily") add("tonguePosture", 100 - m.jawScore - 6);
  }

  // Skin — landmarks can't grade skin, so this is the routine layer.
  add("retinoid", quiz.insecurity === "skin" ? 95 : 60);
  add("spf", 70);

  if (m.symmetry < 84) add("asymmetry", 100 - m.symmetry);

  if (scoreOf("eyeAspect") < 75 || scoreOf("browPosition") < 75) {
    add("depuff", 100 - m.eyesScore);
  }

  if (m.proportionsScore < 72) {
    add("proportions", 100 - m.proportionsScore - 10);
  }

  if (quiz.insecurity === "hair") add("hair", 92);

  add("grooming", quiz.goal === "model" ? 78 : 55);
  add("sleep", 50);

  return out.sort((a, b) => b.weight - a.weight).slice(0, 8);
}
