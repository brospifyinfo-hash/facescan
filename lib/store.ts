"use client";

import { create } from "zustand";
import type { Metric, MetricId } from "./metrics";

// Quiz answers are stored as STABLE KEYS, never as display strings. The
// plan rules below compare against them, so translating the visible option
// labels must not change the logic.
export type Gender = "male" | "female";
export type AgeBand = "under18" | "18-24" | "25-34" | "35plus";
export type Insecurity = "asymmetry" | "jawline" | "eyes" | "skin" | "hair";
export type BodyFat = "under12" | "12-18" | "19-25" | "over25" | "unsure";
export type Mewing = "never" | "sometimes" | "daily";
export type Goal = "model" | "dating" | "self" | "curious";

export interface QuizAnswers {
  gender?: Gender;
  age?: AgeBand;
  insecurity?: Insecurity;
  bodyFat?: BodyFat;
  mewing?: Mewing;
  goal?: Goal;
}

/** Option keys per question, index-aligned with the dictionary's option labels. */
export const QUIZ_KEYS = [
  ["male", "female"],
  ["under18", "18-24", "25-34", "35plus"],
  ["asymmetry", "jawline", "eyes", "skin", "hair"],
  ["under12", "12-18", "19-25", "over25", "unsure"],
  ["never", "sometimes", "daily"],
  ["model", "dating", "self", "curious"],
] as const;

export const QUIZ_FIELDS: Array<keyof QuizAnswers> = [
  "gender",
  "age",
  "insecurity",
  "bodyFat",
  "mewing",
  "goal",
];

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
  email?: string;
  expiredNotice: boolean;
  setAnswer: (key: keyof QuizAnswers, value: string) => void;
  setPhoto: (slot: "front" | "side", photo: PhotoData) => void;
  completeScan: (metrics: ScanMetrics) => void;
  unlock: (email: string) => void;
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
  unlock: (email) => set({ unlocked: true, email, expiresAt: undefined }),

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
      email: undefined,
    }),
}));
