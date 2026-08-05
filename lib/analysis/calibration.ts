// The bridge between published caliper norms and what MediaPipe measures.
//
// WHY THIS EXISTS
// ---------------
// norms.ts holds means and SDs from Farkas' caliper anthropometry. The
// pipeline measures a landmark mesh fitted to a photograph. These are not
// the same quantity: a "bizygomatic width" taken with calipers on bone and
// one taken between two mesh vertices differ by a fixed amount that depends
// on how the mesh was defined, not on the face.
//
// That difference is a CONSTANT SHARED BY EVERY USER. Left uncorrected, the
// scorer reads it as "this person deviates from the norm" and marks
// everybody down by the same amount — which is exactly the failure that has
// dogged this model: real faces scoring far below the reference while the
// synthetic fixture scored fine.
//
// It cannot be derived. It has to be measured, by running the real pipeline
// over real photographs and looking at where the measurements actually land.
// /calibrate does that and emits the block below.
//
// UNITS: standard deviations of the norm, so an offset of +0.8 means "the
// mesh reads this measurement 0.8 SD higher than the caliper norm says, for
// everyone". The correction is subtracted before scoring.

import type { MeasurementId } from "./norms";

export interface CalibrationSet {
  /** Per-measurement offset in SD units. */
  offsets: Partial<Record<MeasurementId, number>>;
  /** How many rated faces the offsets were estimated from. */
  n: number;
  /** Free text: when, on what, by whom rated. */
  provenance: string;
}

/**
 * Current calibration.
 *
 * EMPTY. Every offset is zero until real measurements exist, because a
 * guessed correction is worse than an acknowledged one — it would look
 * calibrated while being invented.
 *
 * To fill it: open /calibrate, drop in photographs with your rating for
 * each, and paste the emitted block here. `n` and `provenance` are not
 * decoration — an offset estimated from four faces is a different claim
 * from one estimated from forty, and the UI surfaces the difference.
 */
export const CALIBRATION: CalibrationSet = {
  offsets: {},
  n: 0,
  provenance: "uncalibrated — offsets are all zero",
};

/** Offset for one measurement, in SD. Zero when uncalibrated. */
export function offsetOf(id: MeasurementId): number {
  return CALIBRATION.offsets[id] ?? 0;
}

export const isCalibrated = () => CALIBRATION.n > 0;
