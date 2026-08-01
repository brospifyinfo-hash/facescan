// Deterministic action plan derived from the real scan metrics + quiz
// answers. Same scan → same plan, every render. No randomness.
//
// Advice stays inside consumer-cosmetic territory. Anything needing a
// prescription or a diagnosis routes the user to a professional instead.

import type { QuizAnswers, ScanMetrics } from "./store";

export interface PlanItem {
  title: string;
  detail: string;
  tag: string;
  emoji: string;
  cadence: string;
  /** Higher = surfaced first. */
  weight: number;
}

export function buildPlan(quiz: QuizAnswers, m: ScanMetrics): PlanItem[] {
  const items: PlanItem[] = [];
  const highBodyFat = quiz.bodyFat === "19–25%" || quiz.bodyFat === "Over 25%";
  const scoreOf = (id: string) =>
    m.metrics.find((x) => x.id === id)?.score ?? 100;

  // --- Jaw & lower third
  if (highBodyFat) {
    items.push({
      title: "Cut body fat toward 12–18%",
      detail:
        "Facial definition is mostly a body-fat story. Moving toward 12–18% will do more for your jaw and cheekbones than any device or hack on the market.",
      tag: "Jawline",
      emoji: "🔥",
      cadence: "Ongoing",
      weight: 100 - m.jawScore + 30,
    });
  }

  if (m.jawScore < 78 || quiz.insecurity === "Weak jawline") {
    items.push({
      title: "Gua sha along the jaw and under the eyes",
      detail:
        "Two sessions a week, light oil, gentle upward strokes from chin to ear. It moves lymphatic fluid — expect a de-puffing effect that lasts hours, not bone remodelling.",
      tag: "Jawline",
      emoji: "🪨",
      cadence: "2× / week",
      weight: 100 - m.jawScore,
    });

    if (quiz.mewing !== "Every day") {
      items.push({
        title: "Daily tongue-posture habit",
        detail:
          "Full tongue on the palate, lips closed, nasal breathing. Evidence for adult bone change is thin — treat it as posture work. Chew evenly on both sides.",
        tag: "Jawline",
        emoji: "👅",
        cadence: "Daily",
        weight: 100 - m.jawScore - 6,
      });
    }
  }

  // --- Skin (landmarks can't grade skin; this is the routine layer)
  items.push({
    title: "Retinoid at night, 3 nights a week",
    detail:
      "Start with adapalene 0.1% or retinol 0.3% on dry skin after cleansing, moisturizer on top. Build to nightly over 8–12 weeks. Going stronger faster only buys irritation.",
    tag: "Skin",
    emoji: "🧴",
    cadence: "3 nights / week",
    weight: quiz.insecurity === "Skin quality" ? 95 : 60,
  });

  items.push({
    title: "SPF 30+ every single morning",
    detail:
      "The highest-return skin intervention there is, and the one people skip. It protects everything else you do — including the retinoid, which makes skin sun-sensitive.",
    tag: "Skin",
    emoji: "☀️",
    cadence: "Daily",
    weight: 70,
  });

  // --- Symmetry
  if (m.symmetry < 84) {
    items.push({
      title: "Audit your asymmetry drivers",
      detail:
        "Alternate your chewing side, stop sleeping face-down on the same cheek, and fix screen height so your head isn't tilted for eight hours a day. Small levers — but the ones you control.",
      tag: "Symmetry",
      emoji: "⚖️",
      cadence: "Ongoing",
      weight: 100 - m.symmetry,
    });
  }

  // --- Eye region, driven by the specific weak measurement
  if (scoreOf("eyeAspect") < 75 || scoreOf("browPosition") < 75) {
    items.push({
      title: "De-puff protocol for the eye area",
      detail:
        "Cut evening sodium, hold 7.5h+ of sleep, moderate alcohol, and sleep with your head slightly elevated. Most eye-area complaints are fluid retention, not bone structure.",
      tag: "Eyes",
      emoji: "👁️",
      cadence: "Daily",
      weight: 100 - m.eyesScore,
    });
  }

  // --- Midface / proportions are largely fixed; steer to what's adjustable
  if (m.proportionsScore < 72) {
    items.push({
      title: "Style around your proportions, don't fight them",
      detail:
        "Vertical proportions are bone and won't change. A haircut with the right height and a beard line that lengthens or widens the lower third shifts the read far more than any exercise.",
      tag: "Proportions",
      emoji: "📐",
      cadence: "Next cut",
      weight: 100 - m.proportionsScore - 10,
    });
  }

  // --- Hair
  if (quiz.insecurity === "Thinning hair") {
    items.push({
      title: "Hair loss: act early, see a doctor",
      detail:
        "Minoxidil and finasteride are the only interventions with solid evidence, and both work best before visible thinning. Book a consult rather than experimenting with supplements.",
      tag: "Hair",
      emoji: "💇",
      cadence: "This month",
      weight: 92,
    });
  }

  // --- Grooming + lifestyle
  items.push({
    title: "Grooming pass with a real barber",
    detail:
      "A cut matched to your face shape, brows cleaned up rather than sculpted, and a consistent beard line. Cheapest, fastest, most visible change on this list.",
    tag: "Grooming",
    emoji: "✂️",
    cadence: "Every 4 weeks",
    weight: quiz.goal === "Model-tier looks" ? 78 : 55,
  });

  items.push({
    title: "Sleep is the multiplier",
    detail:
      "7.5–9 hours on a consistent schedule. Skin repair, fluid balance, and general facial freshness all track sleep more tightly than any product in your cabinet.",
    tag: "Lifestyle",
    emoji: "😴",
    cadence: "Nightly",
    weight: 50,
  });

  return items.sort((a, b) => b.weight - a.weight).slice(0, 8);
}
