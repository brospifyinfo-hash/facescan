"use client";

// Browser-side image compression, run before a photo is uploaded.
//
// WHY IT IS ON THE CLIENT AND NOT THE SERVER
// ------------------------------------------
// Three reasons, in order of how much they matter:
//
//   1. A modern phone photo is 3-8 MB as a data URL. Vercel's serverless
//      request body limit is 4.5 MB, so the uncompressed path does not
//      merely run slowly — it fails outright on a good camera.
//   2. Compressing here means the large version never leaves the device at
//      all. The landing page's claim about photos is already weakened by
//      sending anything to OpenAI; sending the smallest thing that answers
//      the question is the least it can be narrowed to.
//   3. It needs no dependency. Doing it server-side would mean sharp or an
//      equivalent native module in the bundle.
//
// WHAT THE TARGET SIZE IS BASED ON
// --------------------------------
// GPT-4.1 tiles a high-detail image into 512-pixel patches, so resolution
// past roughly 1024 on the long edge buys tiles rather than accuracy. 1024
// keeps the face well above the size where fine landmarks — lid margins,
// the vermilion border, the alar crease — are still resolvable, which is
// what the measurements depend on.
//
// JPEG at 0.85 rather than 0.6: the measurements are sub-pixel ratios
// between small features, and chroma-subsampled mush around the eyelid is
// exactly where the error would land.

export interface CompressedImage {
  /** Full data URL, ready to post. */
  dataUrl: string;
  /** Bytes of the encoded image, for logging and limits. */
  bytes: number;
  width: number;
  height: number;
}

export interface CompressOptions {
  maxEdge?: number;
  quality?: number;
  /** Hard ceiling; quality steps down until the result fits. */
  maxBytes?: number;
}

const DEFAULTS = { maxEdge: 1024, quality: 0.85, maxBytes: 1_400_000 };

function decode(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be decoded"));
    img.src = dataUrl;
  });
}

const bytesOfDataUrl = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
};

/**
 * Downscale and re-encode a data URL.
 *
 * Returns the ORIGINAL untouched when it is already small enough and
 * already JPEG — re-encoding an image that does not need it only adds a
 * generation of loss.
 */
export async function compressForVision(
  dataUrl: string,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const { maxEdge, quality, maxBytes } = { ...DEFAULTS, ...options };
  const img = await decode(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const longest = Math.max(w, h);

  if (longest <= maxEdge && dataUrl.startsWith("data:image/jpeg") && bytesOfDataUrl(dataUrl) <= maxBytes) {
    return { dataUrl, bytes: bytesOfDataUrl(dataUrl), width: w, height: h };
  }

  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // No 2d context is a broken environment, not a recoverable state — but
    // failing the scan over it would be worse than sending the original.
    return { dataUrl, bytes: bytesOfDataUrl(dataUrl), width: w, height: h };
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let q = quality;
  let out = canvas.toDataURL("image/jpeg", q);
  // Step quality down rather than resolution: losing pixels costs landmark
  // precision, losing a little quantisation headroom mostly does not.
  while (bytesOfDataUrl(out) > maxBytes && q > 0.5) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }

  return { dataUrl: out, bytes: bytesOfDataUrl(out), width: targetW, height: targetH };
}
