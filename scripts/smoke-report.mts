// Live smoke test for the deep-dive report.
//
//   npx tsx scripts/smoke-report.mts [path/to/photo.jpg] [locale]
//
// This one DOES call OpenAI and DOES cost money — one request per run. It
// exists for the same reason smoke-vision.mts does: only the real API can
// answer whether the strict report schema is ACCEPTED (a malformed strict
// schema is a 400 at request time), whether the model fills every section,
// and whether the document actually comes back in the customer's language.
//
// Without a photo argument it sends a synthetic gradient. The model is told
// to ground everything in what is visible, so on a faceless image the
// content is meaningless — but the run still proves auth, schema
// acceptance, the language rule, validateReport() and the timing budget.

import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { extname, resolve } from "node:path";

// tsx does not read .env.local; Next does. Parse it here so the script sees
// the same configuration the dev server does.
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* absent is fine */
  }
}

const { VISION_MODEL } = await import("../lib/vision/contract");
const { callVisionModel, VisionError } = await import("../lib/vision/openai");
const {
  REPORT_RESPONSE_FORMAT,
  reportInstruction,
  reportSystemPrompt,
  validateReport,
} = await import("../lib/report/contract");

// Same dependency-free synthetic PNG as smoke-vision.mts.
function syntheticPng(size = 256): string {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      raw[o++] = (x * 255) / size;
      raw[o++] = (y * 255) / size;
      raw[o++] = 128;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png.toString("base64");
}

const MEDIA: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const path = process.argv[2];
const locale = (["de", "en", "es", "fr"].includes(process.argv[3] ?? "")
  ? process.argv[3]
  : "de") as "de" | "en" | "es" | "fr";

let image: { mediaType: string; base64: string };
if (path) {
  const ext = extname(path).toLowerCase();
  const mediaType = MEDIA[ext];
  if (!mediaType) {
    console.error(`Unsupported extension "${ext}". Use jpg, png or webp.`);
    process.exit(1);
  }
  image = { mediaType, base64: readFileSync(resolve(path)).toString("base64") };
  console.log(`photo      ${path}  (${(image.base64.length / 1.37 / 1024).toFixed(0)} KB)`);
} else {
  image = { mediaType: "image/png", base64: syntheticPng() };
  console.log("photo      <synthetic gradient, no face> — content will be generic");
}

// The demo scan's shape: plausible metrics and quiz answers, so the model
// has real material to reason over even on the synthetic image.
const quiz = {
  gender: "male",
  age: "25-34",
  height: 181,
  weight: 78,
  bodyFat: "12-18",
  training: "3-4",
  sleep: "6-7",
  skincare: "basic",
  smoking: "no",
  insecurity: "jawline",
  mewing: "sometimes",
  goal: "self",
};
const metrics = [
  { id: "canthalTilt", label: "Canthal tilt", value: 4.2, unit: "deg", score: 71 },
  { id: "fWHR", label: "Facial width-to-height ratio", value: 1.91, score: 64 },
  { id: "jawAngle", label: "Jaw angle", value: 126, unit: "deg", score: 58 },
  { id: "symmetry", label: "Symmetry", value: 92.1, unit: "%", score: 76 },
  { id: "midfaceRatio", label: "Midface ratio", value: 0.98, score: 62 },
  { id: "lipRatio", label: "Lip ratio", value: 1.4, score: 66 },
];

console.log(`model      ${VISION_MODEL}`);
console.log(`locale     ${locale}`);
console.log(`schema     ${JSON.stringify(REPORT_RESPONSE_FORMAT.schema).length} bytes`);
console.log(`system     ${reportSystemPrompt(locale).length} chars\n`);

const started = Date.now();
try {
  const call = await callVisionModel({
    model: VISION_MODEL,
    system: reportSystemPrompt(locale),
    instruction: reportInstruction(quiz, metrics, false),
    images: [image],
    responseFormat: REPORT_RESPONSE_FORMAT,
    timeoutMs: 60_000,
    maxAttempts: 1,
    maxOutputTokens: 6000,
    requestId: "smoke-report",
  });

  const ms = Date.now() - started;
  const report = validateReport(JSON.parse(call.text));

  console.log(`\nround trip  ${ms} ms  (route budget: 50000 ms)`);
  console.log(`tokens      in ${call.inputTokens} / out ${call.outputTokens}`);
  console.log(`validated   ${report ? "OK" : "REJECTED by validateReport()"}`);

  if (!report) {
    console.log("\nRaw text (first 2000 chars):\n" + call.text.slice(0, 2000));
    process.exit(1);
  }

  console.log(
    `sections    measurements ${report.measurements.length} · strengths ${report.strengths.length} · focus ${report.focus.length} · weeks ${report.weeks.length}`,
  );
  console.log("\n================ REPORT ================\n");
  console.log(`ÜBERBLICK\n${report.overview}\n`);
  for (const m of report.measurements) console.log(`• ${m.area}: ${m.note}`);
  console.log("\nSTÄRKEN");
  for (const s of report.strengths) console.log(`• ${s}`);
  console.log("\nFOKUS");
  for (const f of report.focus) console.log(`• ${f.title}\n  Warum: ${f.why}\n  → ${f.action}`);
  console.log("\nPLAN");
  for (const [i, w] of report.weeks.entries()) {
    console.log(`Woche ${i + 1} — ${w.theme}`);
    for (const s of w.steps) console.log(`  - ${s}`);
  }
  console.log(`\nSCHLUSS\n${report.closing}`);
} catch (err) {
  const ms = Date.now() - started;
  if (err instanceof VisionError) {
    console.error(`\nFAILED after ${ms} ms — kind: ${err.kind}\n${err.message}`);
  } else {
    console.error(`\nFAILED after ${ms} ms`, err);
  }
  process.exit(1);
}
