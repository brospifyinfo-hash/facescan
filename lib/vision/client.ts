"use client";

// Browser side of the vision scan.
//
// The split of work is the point of this file:
//
//   GPT-4.1 (server)  every analysis value — the 25 measurements, the nine
//                     modules, the rating, quality, findings.
//   MediaPipe (here)  the 478-point mesh overlay, the photo's aspect ratio,
//                     the landmark count and the interpupillary distance in
//                     pixels. All four are PRESENTATION, and a language
//                     model cannot produce a mesh.
//
// MediaPipe failing is not an error in this path. The overlay falls back to
// the grid the UI already draws when a side profile is undetectable, and
// the scan still carries a complete rating. That asymmetry is deliberate:
// the thing the user paid attention to must not be lost because a decorative
// overlay could not be computed.

import type { ScanMetrics } from "../store";
import type { AnalysisResponse } from "../analysis/response";
import { compressForVision } from "./compress";
import type { VisionScanFields } from "./adapt";

export interface VisionScanResponse {
  scan: VisionScanFields;
  report: AnalysisResponse;
  meta: { repairs: number; cached: boolean; model: string; promptVersion: string };
}

export class VisionScanError extends Error {
  constructor(
    message: string,
    readonly kind: string = "unknown",
    readonly status = 0,
  ) {
    super(message);
    this.name = "VisionScanError";
  }
}

export type VisionOverlay = Pick<
  ScanMetrics,
  "mesh" | "sideMesh" | "aspect" | "sideAspect" | "landmarkCount" | "interocularPx"
>;

/**
 * What the result carries when MediaPipe found nothing to draw.
 *
 * A scan with no overlay is still a complete scan — the aspect ratio is the
 * only value the UI actually needs, and 0.8 is the same portrait default
 * /scan already renders with.
 */
export const NO_OVERLAY: VisionOverlay = {
  mesh: null,
  sideMesh: null,
  aspect: 0.8,
  sideAspect: null,
  landmarkCount: 0,
  interocularPx: 0,
};

/**
 * Run the full GPT-4.1 analysis over a photo pair.
 *
 * The overlay is threaded IN rather than fetched here, so the caller can
 * run the local detector concurrently with the network call instead of
 * after it — ~200 ms of WASM against a round trip that measured seven
 * seconds on a trivial image and longer on a real face.
 */
export async function analyzeWithVision(input: {
  frontDataUrl: string;
  sideDataUrl?: string | null;
  overlay?: VisionOverlay;
  signal?: AbortSignal;
}): Promise<ScanMetrics> {
  const [front, side] = await Promise.all([
    compressForVision(input.frontDataUrl),
    input.sideDataUrl ? compressForVision(input.sideDataUrl) : Promise.resolve(null),
  ]);

  const res = await fetch("/api/vision-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ front: front.dataUrl, side: side?.dataUrl ?? null }),
    signal: input.signal,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.scan) {
    throw new VisionScanError(
      data?.error ?? `The analysis failed (${res.status}).`,
      data?.kind ?? "unknown",
      res.status,
    );
  }

  const payload = data as VisionScanResponse;

  return {
    ...payload.scan,
    ...(input.overlay ?? NO_OVERLAY),
    report: payload.report,
    scoreSource: "vision",
  };
}
