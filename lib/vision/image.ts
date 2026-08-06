// Server-side image intake.
//
// Everything that arrives here is untrusted: a data URL is a string a
// client chose, and the only thing stopping a 40 MB payload or a
// `data:text/html` from reaching the OpenAI call is this file.
//
// The size ceiling is per image and deliberately below Vercel's 4.5 MB body
// limit, so an oversized upload fails with a message that says what went
// wrong instead of a platform-level 413 that says nothing.

import { VisionError } from "./openai";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Per-image ceiling on the decoded byte size. */
export const MAX_IMAGE_BYTES = 1_800_000;

export interface ParsedImage {
  mediaType: string;
  base64: string;
  bytes: number;
}

const DATA_URL = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

export function parseDataUrl(dataUrl: unknown, label: string): ParsedImage {
  if (typeof dataUrl !== "string" || dataUrl.length === 0) {
    throw new VisionError("malformed", `The ${label} image is missing.`);
  }
  const match = DATA_URL.exec(dataUrl.trim());
  if (!match) {
    throw new VisionError(
      "malformed",
      `The ${label} image must be a base64 data URL (PNG, JPEG or WebP).`,
    );
  }
  const mediaType = match[1].toLowerCase();
  if (!ALLOWED.has(mediaType)) {
    throw new VisionError(
      "malformed",
      `The ${label} image is ${mediaType}; only PNG, JPEG and WebP are accepted.`,
    );
  }
  const base64 = match[2].replace(/\s+/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);

  if (bytes === 0) {
    throw new VisionError("malformed", `The ${label} image is empty.`);
  }
  if (bytes > MAX_IMAGE_BYTES) {
    throw new VisionError(
      "malformed",
      `The ${label} image is ${(bytes / 1e6).toFixed(1)} MB; the limit is ` +
        `${(MAX_IMAGE_BYTES / 1e6).toFixed(1)} MB. Compress it before uploading.`,
    );
  }

  return { mediaType, base64, bytes };
}
