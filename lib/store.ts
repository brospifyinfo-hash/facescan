"use client";

import { create } from "zustand";
import type { Metric, MetricId } from "./metrics";
import type { PlanId } from "./pricing";

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

/**
 * Quiz shape. `keys` are stable identifiers stored in the answers; the
 * visible labels live in the dictionaries and are index-aligned with them,
 * so translating a label can never change the plan rules.
 *
 * `kind: "number"` questions capture a measurement instead of a choice.
 */
export type QuizStep =
  | { kind: "choice"; field: keyof QuizAnswers; keys: readonly string[] }
  | {
      kind: "number";
      field: "height" | "weight";
      min: number;
      max: number;
      step: number;
      unit: string;
      preset: number;
    };

export const QUIZ_STEPS: readonly QuizStep[] = [
  { kind: "choice", field: "gender", keys: ["male", "female", "diverse", "undisclosed"] },
  { kind: "choice", field: "age", keys: ["under18", "18-24", "25-34", "35-44", "45plus"] },
  { kind: "number", field: "height", min: 140, max: 215, step: 1, unit: "cm", preset: 178 },
  { kind: "number", field: "weight", min: 40, max: 180, step: 1, unit: "kg", preset: 78 },
  { kind: "choice", field: "bodyFat", keys: ["under12", "12-18", "19-25", "over25", "unsure"] },
  { kind: "choice", field: "training", keys: ["none", "1-2", "3-4", "5plus"] },
  { kind: "choice", field: "sleep", keys: ["under6", "6-7", "7-8", "over8"] },
  { kind: "choice", field: "skincare", keys: ["none", "basic", "advanced"] },
  { kind: "choice", field: "smoking", keys: ["no", "occasionally", "daily"] },
  { kind: "choice", field: "insecurity", keys: ["asymmetry", "jawline", "eyes", "skin", "hair"] },
  { kind: "choice", field: "mewing", keys: ["never", "sometimes", "daily"] },
  { kind: "choice", field: "goal", keys: ["model", "dating", "self", "curious"] },
] as const;

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
  demo?: boolean;
}

// Photos + scan results live ONLY in this in-memory store. Nothing is
// persisted or uploaded during the free scan — that's what makes the
// "photos never leave your browser" claim on the landing page true.
export const SESSION_TTL_MS = 15 * 60 * 1000;

interface FunnelState {
  quiz: QuizAnswers;
  photos: { front?: PhotoData; side?: PhotoData };
  metrics?: ScanMetrics;
  expiresAt?: number;
  unlocked: boolean;
  /** Which plan was bought — gates the monthly programme and AI report. */
  plan?: PlanId;
  email?: string;
  expiredNotice: boolean;
  setAnswer: (key: keyof QuizAnswers, value: string | number) => void;
  setPhoto: (slot: "front" | "side", photo: PhotoData) => void;
  completeScan: (metrics: ScanMetrics) => void;
  unlock: (email: string, plan?: PlanId) => void;
  purge: () => void;
  clearExpiredNotice: () => void;
  reset: () => void;
}

export const useFunnel = create<FunnelState>((set) => ({
  quiz: {},
  photos: {},
  unlocked: false,
  expiredNotice: false,

  setAnswer: (key, value) =>
    set((s) => ({ quiz: { ...s.quiz, [key]: value } })),

  setPhoto: (slot, photo) =>
    set((s) => ({ photos: { ...s.photos, [slot]: photo } })),

  completeScan: (metrics) =>
    set({ metrics, expiresAt: Date.now() + SESSION_TTL_MS }),

  // Paying stops the auto-purge: the photos must stay in memory so the
  // (consented) full-report generation can still access them.
  unlock: (email, plan = "complete") =>
    set({ unlocked: true, plan, email, expiresAt: undefined }),

  // The session timer really does what the UI claims.
  purge: () =>
    set({
      photos: {},
      metrics: undefined,
      expiresAt: undefined,
      expiredNotice: true,
    }),

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
