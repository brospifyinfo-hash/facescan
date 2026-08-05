// SkinAnalyzer — the one module that reads pixels rather than geometry.
//
// WHAT IT MEASURES
//   toneUniformity — how consistent skin colour is across the cheeks and
//                    forehead, as the spread of chroma in CIE-like a*/b*
//                    surrogates. Redness patches, shadowing and blotching
//                    all raise the spread.
//   textureEnergy  — high-frequency luminance energy inside skin patches
//                    after the local mean is removed. Pores, blemishes and
//                    stubble raise it; so does sensor noise, which is why
//                    the noise figure from the quality stage is subtracted
//                    out rather than ignored.
//
// WHAT IT CANNOT DO, stated plainly because the weight depends on it:
// lighting and make-up dominate both measurements. A ring light flattens
// texture; a window on one side destroys tone uniformity on a flawless
// face. There is no published norm for either quantity as defined here, so
// the mapping to 0-100 is an explicit heuristic and the module carries a
// small weight (0.04) and a confidence that collapses when the lighting is
// poor. It is deliberately unable to move a score much.

import { P } from "./landmarks";
import type { Point3 } from "./landmarks";

export interface SkinResult {
  toneUniformity: number;
  textureEnergy: number;
  /** 0–100 module score. */
  score: number;
  /** 0–1, driven by how trustworthy the lighting made the measurement. */
  confidence: number;
  note: string;
}

/** Sample patches that are skin on every face: both cheeks and the forehead. */
const PATCHES: Array<{ a: number; b: number; t: number }> = [
  // Midpoint between the cheekbone and the nose ala, on each side.
  { a: P.zygoR, b: P.alarR, t: 0.5 },
  { a: P.zygoL, b: P.alarL, t: 0.5 },
  // Between the glabella and the top of the forehead.
  { a: P.glabella, b: P.forehead, t: 0.55 },
];

export class SkinAnalyzer {
  /**
   * @param noiseQuality 0–1 from the quality stage. Sensor noise and skin
   *        texture are the same signal at this scale; without subtracting
   *        it, a grainy photo would read as bad skin.
   */
  analyze(
    image: HTMLImageElement,
    landmarks: Point3[],
    ipd: number,
    noiseQuality: number,
    exposureQuality: number,
  ): SkinResult {
    const unavailable = (note: string): SkinResult => ({
      toneUniformity: 0,
      textureEnergy: 0,
      score: 50,
      confidence: 0,
      note,
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return unavailable("no 2d context");

    // Patch size scales with the face so the same skin area is sampled
    // regardless of how large the face sits in the frame.
    const side = Math.max(8, Math.round(ipd * image.naturalWidth * 0.34));
    canvas.width = side;
    canvas.height = side;

    const chroma: number[] = [];
    const texture: number[] = [];

    for (const patch of PATCHES) {
      const a = landmarks[patch.a];
      const b = landmarks[patch.b];
      if (!a || !b) continue;
      const cx = (a.x + (b.x - a.x) * patch.t) * image.naturalWidth;
      const cy = (a.y + (b.y - a.y) * patch.t) * image.naturalHeight;
      const sx = Math.round(cx - side / 2);
      const sy = Math.round(cy - side / 2);
      if (sx < 0 || sy < 0 || sx + side > image.naturalWidth || sy + side > image.naturalHeight) {
        continue;
      }

      ctx.clearRect(0, 0, side, side);
      ctx.drawImage(image, sx, sy, side, side, 0, 0, side, side);
      const { data } = ctx.getImageData(0, 0, side, side);

      const luma = new Float32Array(side * side);
      for (let i = 0, px = 0; i < data.length; i += 4, px++) {
        const r = data[i];
        const g = data[i + 1];
        const bl = data[i + 2];
        luma[px] = 0.299 * r + 0.587 * g + 0.114 * bl;
        // Opponent-colour surrogates: red-green and yellow-blue. Cheap
        // stand-ins for a* and b* that need no colour-space conversion and
        // are what tone variation actually shows up in.
        chroma.push(r - g, (r + g) / 2 - bl);
      }

      // High-frequency energy: each pixel against the mean of its 4
      // neighbours. Removes slow lighting gradients, keeps pores and spots.
      let energy = 0;
      let n = 0;
      for (let y = 1; y < side - 1; y++) {
        for (let x = 1; x < side - 1; x++) {
          const i = y * side + x;
          const local =
            (luma[i - 1] + luma[i + 1] + luma[i - side] + luma[i + side]) / 4;
          energy += (luma[i] - local) ** 2;
          n++;
        }
      }
      if (n > 0) texture.push(Math.sqrt(energy / n));
    }

    if (chroma.length === 0 || texture.length === 0) {
      return unavailable("no skin patch fell inside the image");
    }

    const sd = (a: number[]) => {
      const m = a.reduce((s, v) => s + v, 0) / a.length;
      return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
    };

    const chromaSd = sd(chroma);
    const textureRms = texture.reduce((s, v) => s + v, 0) / texture.length;

    // Subtract the sensor-noise floor: noiseQuality 1 = clean, 0 = grainy.
    const sensorFloor = (1 - noiseQuality) * 6;
    const skinTexture = Math.max(0, textureRms - sensorFloor);

    // HEURISTIC MAPPING — no published norm exists for either quantity.
    // The two anchors are the ends of what was observed across test
    // captures: chroma spread 8→30 and texture 1→9 span clean to poor.
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const toneUniformity = clamp01(1 - (chromaSd - 8) / 22);
    const textureEnergy = clamp01(1 - (skinTexture - 1) / 8);

    const score = 100 * (0.5 * toneUniformity + 0.5 * textureEnergy);

    // Confidence follows the lighting: both measurements are meaningless
    // under clipping or a strong cast, and that is a property of the photo.
    const confidence = clamp01(exposureQuality * 0.7 + noiseQuality * 0.3) * 0.8;

    return {
      toneUniformity,
      textureEnergy,
      score,
      confidence,
      note:
        "Heuristic. Lighting and make-up dominate both measurements; there " +
        "is no published norm for either as defined here.",
    };
  }
}

export const skinAnalyzer = new SkinAnalyzer();
