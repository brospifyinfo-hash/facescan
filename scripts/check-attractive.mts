// Does the scorer punish faces that deviate in the FLATTERING direction?
//
// Builds three faces: the anthropometric average, and two that differ from
// it the way the facial-aesthetics literature describes attractive faces
// (more positive canthal tilt, larger eye aperture, sharper jaw, more
// taper). If the scorer is measuring averageness rather than aesthetics,
// the "attractive" faces score LOWER than the plain average one.
//
// Run:  npx tsx scripts/check-attractive.mts

import { measure, P, type Point } from "../lib/measure";

const MM = {
  bizygomatic: 137, bigonial: 106, trichionMenton: 187,
  eyeFissureWidth: 31, intercanthal: 33, eyeFissureHeight: 10.5,
  browToLid: 20, noseWidth: 34, mouthWidth: 51,
  philtrum: 16, upperVermillion: 8, lowerVermillion: 10,
};
const SCALE = 0.52 / MM.bizygomatic;
const mm = (v: number) => v * SCALE;

type F = Record<string, number>;

function buildFace(f: F): Point[] {
  const pts: Point[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number) => (pts[i] = { x, y });
  const C = 0.5;
  const top = 0.1;
  const third = f.faceHeight / 3;
  const yGlabella = top + mm(third);
  const ySubnasale = top + mm(2 * third);
  const yMenton = top + mm(f.faceHeight);
  const yPupil = top + mm(f.faceHeight / 2);
  const yLipTop = ySubnasale + mm(f.philtrum);
  const yStomion = yLipTop + mm(f.upperVermillion);
  const yLidUpper = yPupil - mm(f.eyeFissureHeight / 2);

  set(P.forehead, C, top);
  set(P.glabella, C, yGlabella);
  set(P.subnasale, C, ySubnasale);
  set(P.menton, C, yMenton);
  set(P.nasion, C, yGlabella + mm(8));
  set(P.noseTip, C, ySubnasale - mm(15));
  set(P.zygoR, C - mm(f.bizygomatic / 2), yPupil + mm(18));
  set(P.zygoL, C + mm(f.bizygomatic / 2), yPupil + mm(18));
  set(P.jawR, C - mm(f.bigonial / 2), yMenton - mm(45));
  set(P.jawL, C + mm(f.bigonial / 2), yMenton - mm(45));

  const xInner = mm(f.intercanthal / 2);
  const xOuter = xInner + mm(f.eyeFissureWidth);
  const rise = Math.tan((f.tiltDeg * Math.PI) / 180) * mm(f.eyeFissureWidth);
  set(P.eyeInnerR, C - xInner, yPupil);
  set(P.eyeInnerL, C + xInner, yPupil);
  set(P.eyeOuterR, C - xOuter, yPupil - rise);
  set(P.eyeOuterL, C + xOuter, yPupil - rise);
  const xPupil = (xInner + xOuter) / 2;
  set(P.irisR, C - xPupil, yPupil - rise / 2);
  set(P.irisL, C + xPupil, yPupil - rise / 2);
  set(P.lidUpperR, C - xPupil, yLidUpper);
  set(P.lidLowerR, C - xPupil, yPupil + mm(f.eyeFissureHeight / 2));
  set(P.lidUpperL, C + xPupil, yLidUpper);
  set(P.lidLowerL, C + xPupil, yPupil + mm(f.eyeFissureHeight / 2));
  set(P.browR, C - xPupil, yLidUpper - mm(f.browToLid));
  set(P.browL, C + xPupil, yLidUpper - mm(f.browToLid));
  set(P.alarR, C - mm(f.noseWidth / 2), ySubnasale - mm(4));
  set(P.alarL, C + mm(f.noseWidth / 2), ySubnasale - mm(4));
  set(P.mouthR, C - mm(f.mouthWidth / 2), yStomion);
  set(P.mouthL, C + mm(f.mouthWidth / 2), yStomion);
  set(P.lipTop, C, yLipTop);
  set(P.lipUpperInner, C, yStomion);
  set(P.lipLowerInner, C, yStomion + mm(1));
  set(P.lipBottom, C, yStomion + mm(f.lowerVermillion));
  return pts;
}

const AVERAGE: F = {
  bizygomatic: MM.bizygomatic, bigonial: MM.bigonial,
  faceHeight: MM.trichionMenton, eyeFissureWidth: MM.eyeFissureWidth,
  intercanthal: MM.intercanthal, eyeFissureHeight: MM.eyeFissureHeight,
  browToLid: MM.browToLid, noseWidth: MM.noseWidth, mouthWidth: MM.mouthWidth,
  philtrum: MM.philtrum, upperVermillion: MM.upperVermillion,
  lowerVermillion: MM.lowerVermillion, tiltDeg: 5,
};

// Model-tier male face: pronounced positive tilt, large aperture, narrow
// nose, fuller lower lip, tapered jaw, slightly wider bizygomatic.
const MODEL: F = {
  ...AVERAGE,
  tiltDeg: 9.5,
  eyeFissureHeight: 12.4,
  eyeFissureWidth: 33,
  bigonial: 99,
  bizygomatic: 142,
  noseWidth: 31,
  lowerVermillion: 12.5,
  browToLid: 15,
};

// Even further in the same direction.
const EXTREME: F = {
  ...MODEL,
  tiltDeg: 12,
  eyeFissureHeight: 13.5,
  bigonial: 95,
  noseWidth: 29.5,
  lowerVermillion: 14,
};

for (const [name, f] of [
  ["anthropometric average", AVERAGE],
  ["model-tier", MODEL],
  ["model-tier, further", EXTREME],
] as const) {
  const m = measure(buildFace(f));
  const misses = m.metrics.filter((x) => x.position !== "in");
  console.log(`\n=== ${name} ===`);
  console.log(`overall ${m.overall}  harmony ${m.harmony}  in-band ${15 - misses.length}/15`);
  for (const x of misses) {
    console.log(
      `  MISS ${x.id.padEnd(13)} ${String(x.display).padStart(9)}  band [${x.ideal[0]}, ${x.ideal[1]}]  score ${x.score}`,
    );
  }
}
