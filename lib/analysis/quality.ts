// Stage 6: capture quality.
//
// Everything here describes the PHOTO, never the face. A blurry shot of a
// striking face is a bad photo, not a worse face — so these values only
// move `confidence`, and the score engine is not allowed to read them as
// aesthetic signal.
//
// All of it is computed from the pixels and the landmark mesh. Nothing is
// estimated by a model, so nothing here needs a download or a server.

import { P, toDeg } from "./landmarks";
import type { Point, QualityIssue, QualityStage } from "./types";
import type { ScoringWeights } from "./weights";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Map a raw measurement onto 0–1 with a soft floor and ceiling. */
function band(value: number, poor: number, good: number): number {
  if (good === poor) return 0.5;
  return clamp01((value - poor) / (good - poor));
}

interface Sampled {
  gray: Float32Array;
  width: number;
  height: number;
  rMean: number;
  gMean: number;
  bMean: number;
  clippedLow: number;
  clippedHigh: number;
  meanLuma: number;
}

/**
 * Rasterise the face region at a workable size.
 *
 * Sampling the crop rather than the whole frame matters: a sharp face on a
 * blurred background would otherwise read as a blurry photo, and a bright
 * sky behind a backlit subject would hide the underexposure.
 */
function sampleFace(
  image: HTMLImageElement,
  landmarks: Point[],
  target = 224,
): Sampled | null {
  const xs = landmarks.map((p) => p.x);
  const ys = landmarks.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const pad = 0.06;
  const sx = Math.max(0, (minX - pad) * image.naturalWidth);
  const sy = Math.max(0, (minY - pad) * image.naturalHeight);
  const sw = Math.min(image.naturalWidth - sx, (maxX - minX + pad * 2) * image.naturalWidth);
  const sh = Math.min(image.naturalHeight - sy, (maxY - minY + pad * 2) * image.naturalHeight);
  if (sw < 8 || sh < 8) return null;

  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, target, target);

  const { data } = ctx.getImageData(0, 0, target, target);
  const gray = new Float32Array(target * target);
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let lumaSum = 0;
  let low = 0;
  let high = 0;

  for (let i = 0, px = 0; i < data.length; i += 4, px++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    rSum += r;
    gSum += g;
    bSum += b;
    // Rec. 601 luma — matches how the eye weights the channels.
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[px] = y;
    lumaSum += y;
    if (y <= 2) low++;
    if (y >= 253) high++;
  }

  const n = gray.length;
  return {
    gray,
    width: target,
    height: target,
    rMean: rSum / n,
    gMean: gSum / n,
    bMean: bSum / n,
    clippedLow: low / n,
    clippedHigh: high / n,
    meanLuma: lumaSum / n,
  };
}

/** Variance of the Laplacian — the standard blur measure. */
function laplacianVariance(s: Sampled): number {
  const { gray, width: w, height: h } = s;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * Noise estimate: median absolute deviation of the Laplacian.
 *
 * Using the median rather than the mean keeps genuine edges — which are
 * huge Laplacian responses — from being counted as noise.
 */
function noiseSigma(s: Sampled): number {
  const { gray, width: w, height: h } = s;
  const responses: number[] = [];
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      responses.push(
        Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]),
      );
    }
  }
  responses.sort((a, b) => a - b);
  const median = responses[Math.floor(responses.length / 2)] || 0;
  // 0.6745 converts MAD to a Gaussian sigma; /4 accounts for the kernel gain.
  return (median / 0.6745) / 4;
}

/**
 * Motion blur, as gradient anisotropy.
 *
 * Defocus blur attenuates detail equally in every direction; motion blur
 * attenuates it along the direction of travel only. So the ratio of
 * horizontal to vertical gradient energy separates the two: near 1 means
 * isotropic (sharp or defocused), far from 1 means directional smear.
 *
 * HEURISTIC. Real faces are not isotropic to begin with — eyes and lips are
 * horizontal structures — so the measure is calibrated to flag only strong
 * anisotropy and the returned value is deliberately forgiving. It exists to
 * catch a visibly smeared capture, not to grade sharpness twice.
 */
function motionBlurScore(s: Sampled): number {
  const { gray, width: w, height: h } = s;
  let gx = 0;
  let gy = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx += (gray[i + 1] - gray[i - 1]) ** 2;
      gy += (gray[i + w] - gray[i - w]) ** 2;
    }
  }
  if (gx <= 0 || gy <= 0) return 1;
  // Log ratio so smearing either way is treated the same.
  const anisotropy = Math.abs(Math.log(gx / gy));
  // A normal face sits around 0.35; beyond ~1.2 the smear is obvious.
  return clamp01(1 - Math.max(0, anisotropy - 0.45) / 0.9);
}

/**
 * Occlusion proxy.
 *
 * MediaPipe always returns a full mesh, so missing points are not a signal.
 * What does show is geometric implausibility: a hand or hair over part of
 * the face drags those landmarks somewhere the mesh would not otherwise put
 * them, collapsing distances that should be roughly stable.
 */
function occlusionScore(p: Point[]): number {
  const eyeR = Math.hypot(
    p[P.eyeOuterR].x - p[P.eyeInnerR].x,
    p[P.eyeOuterR].y - p[P.eyeInnerR].y,
  );
  const eyeL = Math.hypot(
    p[P.eyeInnerL].x - p[P.eyeOuterL].x,
    p[P.eyeInnerL].y - p[P.eyeOuterL].y,
  );
  const eyeAsym = Math.abs(eyeR - eyeL) / (Math.max(eyeR, eyeL) || 1e-6);

  const browR = Math.abs(p[P.browR].y - p[P.lidUpperR].y);
  const browL = Math.abs(p[P.browL].y - p[P.lidUpperL].y);
  const browAsym = Math.abs(browR - browL) / (Math.max(browR, browL) || 1e-6);

  // Perspective alone produces some asymmetry, so only the excess counts.
  return clamp01(1 - (Math.max(0, eyeAsym - 0.12) + Math.max(0, browAsym - 0.18)) * 2.2);
}

export function analyzeQuality(
  image: HTMLImageElement,
  face: {
    raw: Point[];
    aligned: Point[];
    roll: number;
    /** Pose in radians, from landmarks.estimatePose. */
    pose: { yaw: number; pitch: number; roll: number };
  },
  interocularPx: number,
  weights: ScoringWeights,
): QualityStage {
  // Pose is no longer re-derived here. It used to be estimated a second
  // time, from the nose's drift between the cheek points — a proxy that is
  // itself distorted by the rotation it is trying to measure, and which
  // could disagree with the alignment stage. One estimator, one answer.
  const pose = {
    yaw: toDeg(face.pose.yaw),
    pitch: toDeg(face.pose.pitch),
    roll: toDeg(face.pose.roll),
  };
  const sampled = sampleFace(image, face.raw);

  // Sharpness/exposure/noise need pixels. If the crop failed, report the
  // neutral midpoint rather than inventing a verdict.
  const sharpness = sampled ? band(Math.sqrt(laplacianVariance(sampled)), 2.5, 12) : 0.5;
  const noise = sampled ? 1 - band(noiseSigma(sampled), 0.4, 4.5) : 0.5;
  const motionBlur = sampled ? motionBlurScore(sampled) : 1;

  let exposure = 0.5;
  let whiteBalance = 0.5;
  if (sampled) {
    // Penalise distance from mid-grey and any clipping at either end.
    const lumaOff = Math.abs(sampled.meanLuma - 118) / 118;
    const clipping = sampled.clippedLow + sampled.clippedHigh;
    exposure = clamp01(1 - lumaOff * 1.25 - clipping * 3);

    const mean = (sampled.rMean + sampled.gMean + sampled.bMean) / 3 || 1e-6;
    const cast =
      (Math.abs(sampled.rMean - mean) +
        Math.abs(sampled.gMean - mean) +
        Math.abs(sampled.bMean - mean)) /
      (3 * mean);
    whiteBalance = clamp01(1 - cast * 3.2);
  }

  // 90px between the pupils is roughly the floor for stable landmarks.
  const resolution = band(interocularPx, 40, 130);
  const frontality = clamp01(
    1 - (Math.abs(pose.yaw) / 32 + Math.abs(pose.pitch) / 26) / 2,
  );
  const occlusion = occlusionScore(face.raw);

  const q = weights.quality;
  // Motion blur folds into the sharpness term rather than carrying its own
  // weight: both describe "detail is missing", and giving each a full share
  // would count one smeared photo twice.
  const overall = clamp01(
    Math.min(sharpness, motionBlur) * q.sharpness +
      exposure * q.exposure +
      noise * q.noise +
      whiteBalance * q.whiteBalance +
      resolution * q.resolution +
      frontality * q.frontality +
      occlusion * q.occlusion,
  );

  const issues: QualityIssue[] = [];
  if (sharpness < 0.4) issues.push("blurry");
  if (motionBlur < 0.55) issues.push("motionBlur");
  if (sampled && sampled.meanLuma < 70) issues.push("underexposed");
  if (sampled && (sampled.meanLuma > 185 || sampled.clippedHigh > 0.04)) {
    issues.push("overexposed");
  }
  if (noise < 0.45) issues.push("noisy");
  if (whiteBalance < 0.45) issues.push("colorCast");
  if (resolution < 0.35) issues.push("lowResolution");
  if (frontality < 0.6) issues.push("notFrontal");
  if (occlusion < 0.6) issues.push("occluded");

  return {
    sharpness,
    motionBlur,
    exposure,
    noise,
    whiteBalance,
    resolution,
    frontality,
    occlusion,
    pose,
    overall,
    issues,
  };
}
