// Calibration harness + regression test.
//
// Builds a CANONICAL face from published adult anthropometric means
// (Farkas), runs it through the real measure() pipeline, and reports which
// reference bands it misses. A textbook-average face must land inside its
// bands — if it doesn't, the band is miscalibrated, not the face.
//
// Then varies the face across plausible human ranges to confirm the score
// actually moves.
//
// Run:  npx tsx scripts/measure-spread.mts

import { measure, P, type Point } from "../lib/measure";

// --- Farkas adult means, millimetres ---------------------------------------
const MM = {
  bizygomatic: 137,
  bigonial: 106,
  trichionMenton: 187,
  eyeFissureWidth: 31,
  intercanthal: 33,
  interpupillary: 64, // intercanthal + one fissure width
  eyeFissureHeight: 10.5,
  browToLid: 20,
  noseWidth: 34,
  mouthWidth: 51,
  philtrum: 16,
  upperVermillion: 8,
  lowerVermillion: 10,
};

const SCALE = 0.52 / MM.bizygomatic; // bizygomatic occupies 0.52 of frame width
const mm = (v: number) => v * SCALE;

interface FaceParams {
  bizygomatic: number;
  bigonial: number;
  faceHeight: number;
  eyeFissureWidth: number;
  intercanthal: number;
  eyeFissureHeight: number;
  browToLid: number;
  noseWidth: number;
  mouthWidth: number;
  philtrum: number;
  upperVermillion: number;
  lowerVermillion: number;
  tiltDeg: number;
  thirdSkew: number; // 0 = perfectly equal thirds
  asym: number;      // mm of horizontal asymmetry
}

const CANONICAL: FaceParams = {
  bizygomatic: MM.bizygomatic,
  bigonial: MM.bigonial,
  faceHeight: MM.trichionMenton,
  eyeFissureWidth: MM.eyeFissureWidth,
  intercanthal: MM.intercanthal,
  eyeFissureHeight: MM.eyeFissureHeight,
  browToLid: MM.browToLid,
  noseWidth: MM.noseWidth,
  mouthWidth: MM.mouthWidth,
  philtrum: MM.philtrum,
  upperVermillion: MM.upperVermillion,
  lowerVermillion: MM.lowerVermillion,
  tiltDeg: 5,
  thirdSkew: 0,
  asym: 0,
};

function buildFace(f: FaceParams): Point[] {
  const pts: Point[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number) => (pts[i] = { x, y });
  const C = 0.5;
  const top = 0.1;
  const third = f.faceHeight / 3;

  const yTrichion = top;
  const yGlabella = top + mm(third + f.thirdSkew);
  const ySubnasale = top + mm(2 * third);
  const yMenton = top + mm(f.faceHeight);

  // Pupil line sits at half the total face height.
  const yPupil = top + mm(f.faceHeight / 2);
  const yLipTop = ySubnasale + mm(f.philtrum);
  const yStomion = yLipTop + mm(f.upperVermillion);
  const yLipBottom = yStomion + mm(f.lowerVermillion);
  const yLidUpper = yPupil - mm(f.eyeFissureHeight / 2);
  const yBrow = yLidUpper - mm(f.browToLid);

  set(P.forehead, C, yTrichion);
  set(P.glabella, C, yGlabella);
  set(P.subnasale, C, ySubnasale);
  set(P.menton, C + mm(f.asym), yMenton);
  set(P.nasion, C, yGlabella + mm(8));
  set(P.noseTip, C, ySubnasale - mm(15));

  set(P.zygoR, C - mm(f.bizygomatic / 2), yPupil + mm(18));
  set(P.zygoL, C + mm(f.bizygomatic / 2) + mm(f.asym), yPupil + mm(18));
  set(P.jawR, C - mm(f.bigonial / 2), yMenton - mm(45));
  set(P.jawL, C + mm(f.bigonial / 2) + mm(f.asym), yMenton - mm(45));

  // Eyes: inner canthi at ±intercanthal/2, outer a fissure-width further
  // out and raised by the canthal tilt.
  const xInner = mm(f.intercanthal / 2);
  const xOuter = xInner + mm(f.eyeFissureWidth);
  const rise = Math.tan((f.tiltDeg * Math.PI) / 180) * mm(f.eyeFissureWidth);
  set(P.eyeInnerR, C - xInner, yPupil);
  set(P.eyeInnerL, C + xInner, yPupil);
  set(P.eyeOuterR, C - xOuter, yPupil - rise);
  set(P.eyeOuterL, C + xOuter, yPupil - rise);

  // Iris centres — midpoint of each fissure. This is what makes the
  // interpupillary distance (and therefore ESR / midface) correct.
  const xPupil = (xInner + xOuter) / 2;
  set(P.irisR, C - xPupil, yPupil - rise / 2);
  set(P.irisL, C + xPupil, yPupil - rise / 2);

  set(P.lidUpperR, C - xPupil, yLidUpper);
  set(P.lidLowerR, C - xPupil, yPupil + mm(f.eyeFissureHeight / 2));
  set(P.lidUpperL, C + xPupil, yLidUpper);
  set(P.lidLowerL, C + xPupil, yPupil + mm(f.eyeFissureHeight / 2));

  set(P.browR, C - xPupil, yBrow);
  set(P.browL, C + xPupil, yBrow);

  set(P.alarR, C - mm(f.noseWidth / 2), ySubnasale - mm(4));
  set(P.alarL, C + mm(f.noseWidth / 2), ySubnasale - mm(4));

  set(P.mouthR, C - mm(f.mouthWidth / 2), yStomion);
  set(P.mouthL, C + mm(f.mouthWidth / 2), yStomion);
  set(P.lipTop, C, yLipTop);
  set(P.lipUpperInner, C, yStomion);
  set(P.lipLowerInner, C, yStomion + mm(1));
  set(P.lipBottom, C, yLipBottom);

  return pts;
}

// ---- 1. The canonical face --------------------------------------------
const canon = measure(buildFace(CANONICAL));
console.log("=== CANONICAL anthropometric face (Farkas means) ===");
console.log(`overall ${canon.overall} | harmony ${canon.harmony} | symmetry ${canon.symmetry}`);
const misses = canon.metrics.filter((m) => m.position !== "in");
for (const m of canon.metrics) {
  const flag = m.position === "in" ? "  ok" : "MISS";
  console.log(
    `${flag}  ${m.id.padEnd(14)} ${String(m.display).padStart(9)}   band [${m.ideal[0]}, ${m.ideal[1]}]   score ${m.score}`,
  );
}
console.log(`\n${misses.length}/16 bands missed by a textbook-average face.`);

// ---- 2. Does the score move? ------------------------------------------
const rnd = (base: number, pct: number) => base * (1 + (Math.random() * 2 - 1) * pct);
const scores: number[] = [];
for (let i = 0; i < 4000; i++) {
  const m = measure(
    buildFace({
      ...CANONICAL,
      bizygomatic: rnd(MM.bizygomatic, 0.08),
      bigonial: rnd(MM.bigonial, 0.12),
      faceHeight: rnd(MM.trichionMenton, 0.07),
      eyeFissureWidth: rnd(MM.eyeFissureWidth, 0.1),
      intercanthal: rnd(MM.intercanthal, 0.12),
      eyeFissureHeight: rnd(MM.eyeFissureHeight, 0.18),
      browToLid: rnd(MM.browToLid, 0.25),
      noseWidth: rnd(MM.noseWidth, 0.12),
      mouthWidth: rnd(MM.mouthWidth, 0.1),
      philtrum: rnd(MM.philtrum, 0.2),
      upperVermillion: rnd(MM.upperVermillion, 0.25),
      lowerVermillion: rnd(MM.lowerVermillion, 0.25),
      tiltDeg: 5 + (Math.random() * 2 - 1) * 6,
      thirdSkew: (Math.random() * 2 - 1) * 9,
      asym: (Math.random() * 2 - 1) * 3,
    }),
  );
  scores.push(m.overall);
}
scores.sort((a, b) => a - b);
const q = (p: number) => scores[Math.floor(p * scores.length)];
console.log("\n=== 4000 varied faces ===");
console.log(
  `min ${scores[0]}  p10 ${q(0.1)}  p25 ${q(0.25)}  median ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  max ${scores[scores.length - 1]}`,
);
console.log("distinct values:", new Set(scores).size);
const counts = new Map<number, number>();
for (const s of scores) counts.set(s, (counts.get(s) ?? 0) + 1);
console.log(
  "most common:",
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([v, c]) => `${v} (${((c / scores.length) * 100).toFixed(1)}%)`)
    .join(", "),
);
