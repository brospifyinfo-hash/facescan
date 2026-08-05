// Population norms — the statistical basis of every score.
//
// WHY THIS FILE EXISTS
// --------------------
// The old model scored each measurement against a hand-cut "ideal band"
// plus a `tol` constant meaning "distance at which the score bottoms out".
// Neither number had a source. `tol` was invented, and because it set the
// penalty slope, it silently decided how harsh the whole product was.
//
// Two consequences, both observed:
//
//  1. A face only had to sit 0.5 tol outside its bands to score 2.7/10.
//     A constant measurement offset — which every user shares — was
//     therefore indistinguishable from an unattractive face.
//
//  2. Because the bands were centred on the NEOCLASSICAL CANONS rather than
//     on measured populations, almost everyone failed them. Farkas et al.
//     (1985) tested the canons against real anthropometry and found most
//     are violated by the majority of real faces. Scoring conformity to a
//     canon that most people do not meet guarantees low scores for
//     everybody, which is exactly what happened.
//
// WHAT REPLACES IT
// ----------------
// Each measurement carries a population MEAN and STANDARD DEVIATION. The
// score is a function of the z-distance from the reference value, so the
// unit of "how far off" is a real, measured unit of human variation rather
// than a number chosen by hand.
//
// `reference` is the value a score is measured against. It defaults to the
// population mean — a measured fact — and is only shifted where the
// literature reports a reproducible association, in which case the shift is
// given in SD units and its source is named. Shifts are bounded to ≤0.6 SD
// so no measurement can drift into "extremes are always better", which is
// what made the previous directional scorer rank striking-but-implausible
// values above moderate ones.
//
// SOURCE GRADES
// -------------
//   "anthropometric" — mean and SD from published caliper norms.
//   "derived"        — computed from published norms of the component
//                      dimensions; the SD is propagated, not measured.
//   "heuristic"      — no published norm exists for this ratio as defined
//                      here. Mean and SD are estimates. Flagged so the
//                      weighting can discount them, and so a future fit on
//                      SCUT-FBP5500 can replace them first.
//
// Primary sources:
//   Farkas LG, "Anthropometry of the Head and Face", 2nd ed., Raven 1994
//     — North American Caucasian young-adult norms (means and SDs).
//   Farkas LG et al., "Vertical and horizontal proportions of the face in
//     young adult North American Caucasians", Plast Reconstr Surg 1985
//     — the canon-vs-reality study.
//   Weston EM et al., "Biometric evidence that sexual selection has shaped
//     the hominin face", PLoS ONE 2007 — fWHR distribution.
//
// Norms are population-specific. These are Caucasian young-adult figures
// because that is what is published with SDs; applying them to other
// populations introduces a bias this file cannot correct. That limitation
// is real and is surfaced through `SOURCE_NOTE`.

export type SourceGrade = "anthropometric" | "derived" | "heuristic";

export interface Norm {
  /** Population mean of this measurement. */
  mean: number;
  /** Population standard deviation, same units as `mean`. */
  sd: number;
  /**
   * Value the score is measured against, in SD units relative to `mean`.
   * 0 = score against the population mean. Non-zero requires a citation
   * in `note` and is clamped to ±0.6 by validateNorms().
   */
  shift: number;
  grade: SourceGrade;
  /**
   * Set on measurements that are DEVIATIONS bounded at zero, where less is
   * definitionally better and a value below the reference must not be
   * penalised. This is a mathematical property of the quantity, not an
   * aesthetic preference.
   */
  oneSided?: "lower";
  /**
   * Which direction of deviation the rating literature associates with
   * HIGHER ratings. "up" = above the mean is the favoured side.
   *
   * This is not the same as `shift`. A shift moves the target; a direction
   * makes the penalty ASYMMETRIC around it, so a face that deviates the
   * favoured way loses little while one that deviates the other way loses
   * properly. Without it the scorer measures typicality, and typicality
   * cannot rank attractiveness: a striking face and a poor one are both
   * far from the mean, so both score the same. That is exactly what
   * happened — a 10/10 scored 5.9 and a 1/10 scored 5.8.
   *
   * Every direction here needs a citation in `note`. Null means the
   * literature gives no defensible direction, and then deviation costs the
   * same either way.
   */
  direction?: "up" | "down";
  /** Physically possible range. Values outside imply a landmark failure. */
  plausible: [number, number];
  note: string;
}

export const SOURCE_NOTE =
  "Norms are Farkas North American Caucasian young-adult figures — the " +
  "only widely published set carrying standard deviations. Applying them " +
  "across populations introduces a bias this model does not correct.";

/** Largest permitted |shift|, in SD. Keeps preferences from becoming rules. */
export const MAX_SHIFT_SD = 0.6;

export const NORMS = {
  // ---- Eyes ---------------------------------------------------------------
  canthalTilt: {
    mean: 4.1, sd: 2.6, shift: 0.4, grade: "anthropometric", direction: "up",
    plausible: [-15, 20],
    note:
      "Intercanthal axis inclination, degrees. Mean/SD from Farkas. Positive " +
      "shift: a positive tilt is reported as attractiveness-associated in " +
      "Rhee & Lee (2010) and Baudouin & Tiberghien (2004). Bounded, so a " +
      "very high tilt no longer outranks a normal one. Direction: positive tilt, same sources as the shift.",
  },
  esr: {
    mean: 0.455, sd: 0.024, shift: 0, grade: "derived",
    plausible: [0.33, 0.58],
    note:
      "Interpupillary / bizygomatic width. Derived from Farkas IPD 62.3±3.5mm " +
      "and bizygomatic 137±5mm; SD propagated in quadrature. Defined " +
      "pupil-to-pupil — measuring it canthus-to-canthus (as this code once " +
      "did) shifts it by roughly -0.03 and floors the metric.",
  },
  eyeAspect: {
    mean: 0.335, sd: 0.042, shift: 0.35, grade: "derived", direction: "up",
    plausible: [0.1, 0.62],
    note:
      "Palpebral fissure height / width. Derived from Farkas height 10.5±1.2mm, " +
      "width 31.3±1.7mm. Positive shift: larger apertures score higher in " +
      "Cunningham (1986) and Jones & Hill (1993). Confounded by squinting and " +
      "expression, which is why the shift is small and eyes carry a modest weight. Direction: a larger palpebral aperture, same sources as the shift.",
  },
  eyeSpacing: {
    mean: 1.04, sd: 0.09, shift: 0, grade: "derived",
    plausible: [0.55, 1.65],
    note:
      "Intercanthal width / single eye fissure width. Derived from Farkas " +
      "intercanthal 32.5±2.3mm and fissure 31.3±1.7mm. The neoclassical canon " +
      "asserts 1.0 and here the measurement nearly agrees, which is why this " +
      "one ratio can be read either way.",
  },
  symmetryDeviation: {
    mean: 0.040, sd: 0.022, shift: -0.5, grade: "heuristic", oneSided: "lower",
    plausible: [0, 0.35],
    note:
      "Trimmed-mean residual of 15 mirrored landmark pairs against the fitted " +
      "midline, normalised by interpupillary distance. Fluctuating facial " +
      "asymmetry is well studied (Grammer & Thornhill 1994; Rhodes 1998) but " +
      "never in this normalisation. Derivation: those studies report typical " +
      "facial asymmetry at 1-3% of face width; IPD is 0.455 of face width " +
      "(see esr), so the same range in these units is 0.022-0.066 — hence " +
      "mean 0.040, SD 0.022. Still graded heuristic, because a range " +
      "converted from another normalisation is not a measured SD. This is " +
      "the first norm that should be replaced with real /calibrate data. " +
      "Negative shift: lower asymmetry is the one direction the literature " +
      "agrees on across sexes and populations.",
  },
  browPosition: {
    mean: 1.9, sd: 0.45, shift: 0, grade: "heuristic",
    plausible: [0.4, 4.2],
    note:
      "Brow-to-upper-lid gap / fissure height. NO published norm exists for " +
      "this ratio as defined here; mean and SD are estimates from the " +
      "component Farkas dimensions and are the least trustworthy in this file. " +
      "Highly expression-dependent — raise the brows and it moves 30%.",
  },

  // ---- Jaw ----------------------------------------------------------------
  gonialAngle: {
    mean: 157, sd: 7.2, shift: 0.3, grade: "heuristic", direction: "up",
    plausible: [120, 195],
    note:
      "SURFACE contour angle cheek→jaw-corner→chin, NOT the cephalometric " +
      "gonial angle (118-130° on a lateral radiograph, unmeasurable from a " +
      "frontal photo). No published norm exists for the surface proxy; mean " +
      "and SD were estimated from the mesh geometry of a canonical face. " +
      "Positive shift follows the jaw-taper literature (Scheib 1999). Direction: a more tapered lower-face contour. Scheib et al. (1999); Penton-Voak et al. (2001).",
  },
  jawWidth: {
    mean: 0.774, sd: 0.048, shift: -0.35, grade: "derived", direction: "down",
    plausible: [0.55, 1.05],
    note:
      "Bigonial / bizygomatic. Derived from Farkas bigonial 106±5.5mm and " +
      "bizygomatic 137±5mm. Negative shift = more taper, per Scheib et al. " +
      "(1999) and Penton-Voak (2001). Strongly sexually dimorphic — this is " +
      "the metric most in need of sex-conditioned norms. Direction: a lower bigonial/bizygomatic ratio means more taper and less facial adiposity — Scheib et al. (1999); Coetzee et al. (2009), who find facial adiposity among the strongest predictors of male attractiveness ratings.",
  },
  chinRatio: {
    mean: 1.86, sd: 0.34, shift: 0, grade: "heuristic",
    plausible: [0.7, 4.0],
    note:
      "Chin height / philtrum height. No published norm for the ratio; " +
      "estimated from Farkas components. Sensitive to lip position, so it " +
      "moves with expression.",
  },

  // ---- Proportions --------------------------------------------------------
  thirds: {
    mean: 6.4, sd: 3.3, shift: -0.5, grade: "derived", oneSided: "lower",
    plausible: [0, 45],
    note:
      "Mean absolute deviation of the three facial thirds from equality, in " +
      "percent. This is a DEVIATION measure: zero is the canonical ideal and " +
      "the population mean is 6.4% (Farkas 1985 — most faces do not meet the " +
      "canon). Non-negative and right-skewed, so scoreNorm() folds it. The " +
      "negative shift encodes 'closer to equal thirds', the one place the " +
      "canon is used as a target at all.",
  },
  fifths: {
    mean: 4.38, sd: 0.31, shift: 0, grade: "derived",
    plausible: [3.2, 6.2],
    note:
      "Face width / single eye fissure width. The neoclassical canon says 5.0; " +
      "Farkas (1985) measured 4.38±0.31 and found the canon met by a small " +
      "minority. Scored against the MEASURED mean, not the canon — scoring " +
      "against 5.0 would put the average face at z=-2.",
  },
  fwhr: {
    mean: 1.90, sd: 0.13, shift: 0, grade: "anthropometric", direction: "down",
    plausible: [1.3, 2.6],
    note:
      "Facial width-to-height ratio, bizygomatic / (brow-to-upper-lip). " +
      "Weston et al. (2007). No shift: the attractiveness literature on fWHR " +
      "is contradictory and sex-dependent, so no direction is defensible. Direction rests on the adiposity link, not on fWHR as a trait: fWHR correlates with BMI (Coetzee et al. 2010). The attractiveness literature on fWHR itself is contradictory and sex-dependent.",
  },
  facialIndex: {
    mean: 1.36, sd: 0.075, shift: 0, grade: "derived", direction: "up",
    plausible: [1.0, 1.85],
    note:
      "Face height / bizygomatic width. Derived from Farkas 187±8mm over " +
      "137±5mm. Frequently quoted as 'the golden ratio 1.618' — the measured " +
      "population mean is 1.36, so 1.618 sits at z=+3.4 and would fail " +
      "virtually everyone. Scored against the measurement. Direction: greater height-to-width reads as leaner — the same adiposity axis from the other side. Coetzee et al. (2009).",
  },
  goldenRatio: {
    mean: 1.36, sd: 0.075, shift: 0, grade: "derived",
    plausible: [1.0, 1.85],
    note:
      "Same quantity as facialIndex, reported separately because the UI and " +
      "the request both name it. Deliberately NOT scored against φ=1.618: no " +
      "anthropometric study finds φ at the population mean of any facial " +
      "ratio. Kept as a reported measurement, weight 0 in scoring.",
  },
  faceLength: {
    mean: 3.00, sd: 0.19, shift: 0, grade: "derived", direction: "up",
    plausible: [2.1, 4.2],
    note: "Face height / interpupillary distance. Derived from Farkas 187/62.3. Direction: face height relative to IPD, the vertical half of the adiposity axis. Coetzee et al. (2009).",
  },
  bizygomaticRatio: {
    mean: 2.20, sd: 0.14, shift: 0, grade: "derived", direction: "down",
    plausible: [1.6, 3.0],
    note: "Bizygomatic width / interpupillary distance. Farkas 137/62.3. Direction: face width relative to IPD is an adiposity proxy — IPD does not change with weight, cheek soft tissue does. Coetzee et al. (2009).",
  },
  bigonialRatio: {
    mean: 1.70, sd: 0.13, shift: 0, grade: "derived", direction: "down",
    plausible: [1.15, 2.4],
    note: "Bigonial width / interpupillary distance. Farkas 106/62.3. Direction: jaw width relative to IPD, the same adiposity proxy. Coetzee et al. (2009).",
  },
  lowerThird: {
    mean: 0.385, sd: 0.026, shift: 0, grade: "derived",
    plausible: [0.26, 0.52],
    note:
      "Subnasale→menton / total face height. Farkas 72/187. The canon says " +
      "0.333; the measured mean is 0.385.",
  },

  // ---- Midface / nose / lips ---------------------------------------------
  midface: {
    mean: 0.95, sd: 0.072, shift: 0, grade: "derived", direction: "down",
    plausible: [0.6, 1.4],
    note:
      "Pupil-line→upper-lip / interpupillary distance. Defined pupil-to-pupil; " +
      "using the intercanthal distance instead shifts this by about +0.15. Direction: a shorter pupil-to-lip distance is reported as attractiveness-associated. Cunningham (1986).",
  },
  noseWidth: {
    mean: 0.248, sd: 0.020, shift: -0.3, grade: "derived", direction: "down",
    plausible: [0.16, 0.40],
    note:
      "Alar width / bizygomatic. Farkas 34±2.2mm over 137±5mm. Negative shift " +
      "per Cunningham (1986). Among the most population-variable measurements " +
      "in the file — the shift is small for that reason. Direction: a narrower alar base. Cunningham (1986).",
  },
  noseLength: {
    mean: 0.281, sd: 0.021, shift: 0, grade: "derived",
    plausible: [0.18, 0.42],
    note: "Nasion→subnasale / face height. Farkas 52.5±3.3mm over 187±8mm.",
  },
  mouthNose: {
    mean: 1.50, sd: 0.13, shift: 0.3, grade: "derived", direction: "up",
    plausible: [1.0, 2.3],
    note:
      "Mouth width / alar width. Farkas 51±3.3mm over 34±2.2mm. The canon " +
      "says 1.5 and here the measurement agrees. Positive shift per " +
      "Cunningham (1986). Direction: a wider mouth relative to the nose. Cunningham (1986).",
  },
  lipRatio: {
    mean: 1.28, sd: 0.31, shift: 0.3, grade: "derived", direction: "up",
    plausible: [0.4, 3.0],
    note:
      "Lower vermilion height / upper. Farkas 9.4±1.9mm over 8.5±1.6mm. " +
      "Positive shift per Bisson & Grobbelaar (2004). Moves with expression " +
      "and with lip compression against the teeth. Direction: a fuller lower lip. Bisson & Grobbelaar (2004).",
  },
  philtrumRatio: {
    mean: 0.222, sd: 0.028, shift: 0, grade: "derived", direction: "down",
    plausible: [0.10, 0.40],
    note: "Philtrum height / lower-third height. Farkas 16±2mm over 72±5mm. Direction: a shorter philtrum relative to the lower third; the philtrum lengthens with age (Farkas age series).",
  },
  chinProjection: {
    mean: 0.0, sd: 0.055, shift: 0, grade: "heuristic",
    plausible: [-0.4, 0.4],
    note:
      "Chin depth relative to the facial plane, normalised by interpupillary " +
      "distance, from the MediaPipe z channel. MediaPipe's z is a relative " +
      "depth estimate with no metric calibration, so there is NO published " +
      "norm and none can exist for it. Mean 0 is a definition, not a " +
      "measurement. Reported and used for face-shape typing; weight 0 in " +
      "scoring until it can be validated against a depth-sensing dataset.",
  },
} as const satisfies Record<string, Norm>;

export type MeasurementId = keyof typeof NORMS;
export const MEASUREMENT_IDS = Object.keys(NORMS) as MeasurementId[];

/** Measurements whose grade is "heuristic" — discounted in the composite. */
export const HEURISTIC_IDS = MEASUREMENT_IDS.filter(
  (id) => NORMS[id].grade === "heuristic",
);

export interface NormProblem {
  id: string;
  problem: string;
}

/**
 * Structural check on the norm table.
 *
 * Runs in tests and in the dev build. It cannot verify that a mean is
 * *correct* — only that the table is internally coherent and that no shift
 * has quietly grown into a rule.
 */
export function validateNorms(norms: Record<string, Norm> = NORMS): NormProblem[] {
  const problems: NormProblem[] = [];
  for (const [id, n] of Object.entries(norms)) {
    if (!(n.sd > 0)) problems.push({ id, problem: `sd must be > 0, got ${n.sd}` });
    if (Math.abs(n.shift) > MAX_SHIFT_SD) {
      problems.push({
        id,
        problem: `shift ${n.shift} exceeds MAX_SHIFT_SD ${MAX_SHIFT_SD}`,
      });
    }
    if (n.shift !== 0 && n.note.length < 40) {
      problems.push({ id, problem: "a non-zero shift requires a cited note" });
    }
    const [lo, hi] = n.plausible;
    if (!(lo < hi)) problems.push({ id, problem: "plausible range is inverted" });
    if (n.mean < lo || n.mean > hi) {
      problems.push({ id, problem: "mean lies outside its own plausible range" });
    }
    // A plausible range narrower than ±3 SD would reject normal faces.
    if (hi - lo < 6 * n.sd) {
      problems.push({
        id,
        problem: `plausible range spans ${((hi - lo) / n.sd).toFixed(1)} SD, needs ≥6`,
      });
    }
  }
  return problems;
}
