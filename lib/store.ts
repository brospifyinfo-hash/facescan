"use client";

import { create } from "zustand";
import type { Metric, MetricId } from "./metrics";
import type { PlanId } from "./pricing";
import type { AnalysisResponse } from "./analysis/response";

// Quiz answers are stored as STABLE KEYS, never as display strings. The
// plan rules below compare against them, so translating the visible option
// labels must not change the logic.
export type Gender = "male" | "female" | "diverse" | "undisclosed";
export type AgeBand = "under18" | "18-24" | "25-34" | "35-44" | "45plus";
export type Insecurity = "asymmetry" | "jawline" | "eyes" | "skin" | "hair";
export type BodyFat = "under12" | "12-18" | "19-25" | "over25" | "unsure";
export type Mewing = "never" | "sometimes" | "daily";
export type Goal = "model" | "dating" | "self" | "curious";

export type Sleep = "under6" | "6-7" | "7-8" | "over8";
export type Training = "none" | "1-2" | "3-4" | "5plus";
export type Skincare = "none" | "basic" | "advanced";
export type Smoking = "no" | "occasionally" | "daily";

export interface QuizAnswers {
  gender?: Gender;
  age?: AgeBand;
  /** Centimetres. */
  height?: number;
  /** Kilograms. */
  weight?: number;
  insecurity?: Insecurity;
  bodyFat?: BodyFat;
  training?: Training;
  sleep?: Sleep;
  skincare?: Skincare;
  smoking?: Smoking;
  mewing?: Mewing;
  goal?: Goal;
}

/** BMI from the quiz, when both values were given. */
export function bmiOf(q: QuizAnswers): number | null {
  if (!q.height || !q.weight) return null;
  const m = q.height / 100;
  if (m <= 0.5) return null;
  return Number((q.weight / (m * m)).toFixed(1));
}



export interface PhotoData {
  dataUrl: string;
  name: string;
}

/** SVG path data in normalized (0..1) image space — overlays the photo exactly. */
export interface MeshPaths {
  tesselation: string;
  contours: string;
  dots: string;
}

export interface ScanMetrics {
  /** Hero figure, 0–10 with one decimal. */
  overall: number;
  harmony: number;
  symmetry: number;
  eyesScore: number;
  jawScore: number;
  proportionsScore: number;
  midfaceScore: number;
  metrics: Metric[];
  /** IDs of the three lowest-scoring measurements. */
  weakest: MetricId[];
  interocularPx: number;
  landmarkCount: number;
  /** Natural width / height of the analyzed photo — drives the mesh overlay box. */
  aspect: number;
  mesh: MeshPaths | null;
  /** Landmark overlay for the side photo — null when no face was detected
   *  there (common on a true 90° profile); the UI then shows the grid. */
  sideMesh: MeshPaths | null;
  sideAspect: number | null;
  /**
   * How much to trust this result, 0–1. Driven by capture quality and
   * embedding stability — never by the face itself, so a bad photo lowers
   * certainty, not the score.
   */
  confidence: number;
  /** Capture problems worth telling the user about. */
  qualityIssues: string[];
  /**
   * Full explainability payload from the analyzer: per-module score,
   * weight and confidence, every measurement with its z-distance and
   * source grade, strengths, weaknesses, recommendations and the caveats
   * that bound the reading. Absent on the demo path, which has no pixels.
   */
  report?: AnalysisResponse;
  /**
   * Which engine produced the numbers above.
   *
   * "geometry" — the on-device pipeline: landmark measurements scored
   *   against the published norms in lib/analysis/norms.ts. Its headline is
   *   a conformity-to-reference-proportions figure.
   * "vision"   — GPT-4.1 Vision: every value, including the rating, comes
   *   from the model (lib/vision/). Its headline is an attractiveness
   *   judgement on the rubric in lib/vision/rubric.ts.
   *
   * The two headlines are anchored on different scales, which is why
   * percentileFor() has to be told which one it is looking at rather than
   * assuming. Absent means "geometry", so the demo path is unaffected.
   */
  scoreSource?: "geometry" | "vision";
  demo?: boolean;
}

// Photos + scan results live ONLY in this in-memory store. Nothing is
// persisted or uploaded during the free scan — that's what makes the
// "photos never leave your browser" claim on the landing page true.
export const SESSION_TTL_MS = 15 * 60 * 1000;

interface FunnelState {
  /**
   * DER FRAGEBOGEN IST WEG, DAS FELD NICHT.
   *
   * Es bleibt leer, und das ist Absicht. Die Analyse spricht QuizAnswers als
   * Eingabe — buildPlan, die Produktzuordnung, der Report-Prompt und der
   * Stil-Prompt nehmen es entgegen und kommen alle mit einem leeren Objekt
   * zurecht (der Plan liefert dann acht rein messwertgetriebene Massnahmen
   * statt der auf Antworten zugeschnittenen). Den Typ aus der Engine zu
   * reissen waere eine Operation an sechs Modulen fuer null sichtbaren
   * Gewinn; ihn hier zu behalten kostet ein leeres Objekt.
   *
   * Wer den Fragebogen je zurueckholen will, fuellt dieses Feld — und alles
   * dahinter funktioniert wieder wie vorher.
   */
  quiz: QuizAnswers;
  photos: { front?: PhotoData; side?: PhotoData };
  metrics?: ScanMetrics;
  expiresAt?: number;
  unlocked: boolean;
  /**
   * True from the moment a payment is confirmed until it resolves.
   *
   * It exists to stop the privacy countdown from firing mid-transaction. The
   * timer purges the photos and the scan and sends the visitor back to the
   * home page — correct behaviour for somebody who wandered off, catastrophic
   * for somebody whose card is being charged right now. `unlocked` cannot
   * cover this: it only becomes true once the entitlement is granted, which is
   * seconds AFTER the money moves and can be minutes for a delayed method.
   */
  paying: boolean;
  /** Which plan was bought — gates the monthly programme and AI report. */
  plan?: PlanId;
  email?: string;
  expiredNotice: boolean;
  setPhoto: (slot: "front" | "side", photo: PhotoData) => void;
  completeScan: (metrics: ScanMetrics) => void;
  setPaying: (paying: boolean) => void;
  unlock: (email: string, plan?: PlanId) => void;
  purge: () => void;
  clearExpiredNotice: () => void;
  reset: () => void;
}

export const useFunnel = create<FunnelState>((set) => ({
  quiz: {},
  photos: {},
  unlocked: false,
  paying: false,
  expiredNotice: false,

  setPhoto: (slot, photo) =>
    set((s) => ({ photos: { ...s.photos, [slot]: photo } })),

  completeScan: (metrics) =>
    set({ metrics, expiresAt: Date.now() + SESSION_TTL_MS }),

  // Paying stops the auto-purge: the photos must stay in memory so the
  // (consented) full-report generation can still access them.
  unlock: (email, plan = "pro") =>
    set({ unlocked: true, plan, email, expiresAt: undefined }),

  setPaying: (paying) => set({ paying }),

  // The session timer really does what the UI claims — but never while a
  // payment is in flight. A purge there would delete the scan the customer is
  // paying FOR, and the timer runs on a clock that knows nothing about the
  // card being charged. Guarded here as well as in SessionTimer, because this
  // is the function that does the damage.
  purge: () =>
    set((s) =>
      s.paying
        ? s
        : {
            photos: {},
            metrics: undefined,
            expiresAt: undefined,
            expiredNotice: true,
          },
    ),

  clearExpiredNotice: () => set({ expiredNotice: false }),

  reset: () =>
    set({
      quiz: {},
      photos: {},
      metrics: undefined,
      expiresAt: undefined,
      unlocked: false,
      plan: undefined,
      email: undefined,
    }),
}));
