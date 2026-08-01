"use client";

import { create } from "zustand";
import type { Metric } from "./metrics";

export interface QuizAnswers {
  gender?: string;
  age?: string;
  insecurity?: string;
  bodyFat?: string;
  mewing?: string;
  goal?: string;
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
  /** Hero figure, 0–10 with one decimal. Derived from `harmony`. */
  overall: number;
  harmony: number;
  symmetry: number;
  /** Category composites, 0–100. */
  eyesScore: number;
  jawScore: number;
  proportionsScore: number;
  midfaceScore: number;
  /** The full measurement set — see lib/metrics.ts. */
  metrics: Metric[];
  /** Labels of the three lowest-scoring measurements. */
  weakest: string[];
  canthalTiltDeg: number;
  canthalTiltClass: "positive" | "neutral" | "negative";
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
  /** Set once the (mock) payment succeeds — unlocks the full dashboard. */
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

  // Scan completion starts the real privacy countdown shown on /results.
  completeScan: (metrics) =>
    set({ metrics, expiresAt: Date.now() + SESSION_TTL_MS }),

  // Paying stops the auto-purge: the photos must stay in memory so the
  // (consented) full-report generation can still access them.
  unlock: (email) => set({ unlocked: true, email, expiresAt: undefined }),

  // The session timer really does what the UI claims: photos and results
  // are wiped from memory when the countdown hits zero.
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
