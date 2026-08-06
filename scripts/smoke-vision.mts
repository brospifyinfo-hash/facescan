// Live smoke test for the GPT-4.1 Vision path.
//
//   npx tsx scripts/smoke-vision.mts [path/to/photo.jpg]
//
// This one DOES call OpenAI and DOES cost money — one request per run. It
// exists because scripts/test-vision.mts deliberately never touches the
// network, so nothing else in the repo can answer the two questions that
// only the real API can:
//
//   1. Does OpenAI ACCEPT the generated strict schema? A malformed strict
//      schema is a 400 at request time, and no amount of local testing
//      finds it — the schema is only validated by the server.
//   2. Does the model actually fill all 25 measurements, or does it need
//      the repair path on every call?
//
// Without an argument it sends a synthetic image with no face in it, which
// is still a useful test: it exercises auth, the model name, vision input,
// schema acceptance and the refusal path, without needing a photograph of
// a real person.

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

const { PROMPT_VERSION, VISION_MODEL } = await import("../lib/vision/contract");
const { buildSystemPrompt, buildUserInstruction } = await import("../lib/vision/prompt");
const { VISION_RESPONSE_FORMAT } = await import("../lib/vision/schema");
const { callVisionModel, VisionError } = await import("../lib/vision/openai");
const { validateVision } = await import("../lib/vision/validate");
const { adaptVision } = await import("../lib/vision/adapt");
const { MEASUREMENT_IDS } = await import("../lib/analysis/norms");

// ---------------------------------------------------------------------------
// A valid PNG with no face in it, built without a dependency.
// ---------------------------------------------------------------------------
function syntheticPng(size = 256): string {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
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
  console.log("photo      <synthetic gradient, no face> — expect a refusal");
}

console.log(`model      ${VISION_MODEL}`);
console.log(`prompt     ${PROMPT_VERSION}`);
console.log(`schema     ${JSON.stringify(VISION_RESPONSE_FORMAT.schema).length} bytes`);
console.log(`system     ${buildSystemPrompt().length} chars\n`);

const started = Date.now();
try {
  const call = await callVisionModel({
    model: VISION_MODEL,
    system: buildSystemPrompt(),
    instruction: buildUserInstruction(false),
    images: [image],
    responseFormat: VISION_RESPONSE_FORMAT,
    timeoutMs: 60_000,
    maxAttempts: 2,
    maxOutputTokens: 4000,
    requestId: "smoke",
  });

  console.log(`\n✓ schema accepted, response in ${Date.now() - started} ms`);
  console.log(`  tokens: ${call.inputTokens} in / ${call.outputTokens} out, ${call.attempts} attempt(s)`);

  const validated = validateVision(call.text);
  const payload = adaptVision(validated, {
    model: VISION_MODEL,
    promptVersion: PROMPT_VERSION,
    cached: false,
  });

  console.log(`\n  OVERALL   ${payload.scan.overall.toFixed(1)} / 10   (percentile ${payload.report.percentile})`);
  console.log(`  harmony   ${payload.scan.harmony}   confidence ${payload.report.confidence}`);
  console.log(`  shape     ${payload.report.faceShape.shape}`);
  console.log(`  repairs   ${validated.repairs}${validated.repairs ? `  — ${validated.repairNotes.join("; ")}` : ""}`);
  console.log(`  dropped   ${validated.implausible.length ? validated.implausible.join(", ") : "none"}`);

  console.log("\n  modules");
  for (const k of ["symmetry", "proportions", "jaw", "eyes", "nose", "lips", "skin", "hair", "faceShape"] as const) {
    const m = payload.report[k];
    console.log(`    ${k.padEnd(12)} ${String(m.score ?? "—").padStart(5)}   conf ${m.confidence.toFixed(2)}   w ${m.weight}`);
  }

  console.log(`\n  measurements  ${payload.report.measurements.length}/${MEASUREMENT_IDS.length} reported, ` +
    `${payload.report.measurements.filter((m) => m.used).length} used`);
  for (const m of payload.report.measurements) {
    console.log(
      `    ${m.id.padEnd(18)} ${m.value.toFixed(4).padStart(10)}   ` +
        `z ${m.z === null ? "  —  " : m.z.toFixed(2).padStart(5)}   ${m.grade}`,
    );
  }

  console.log(`\n  quality   overall ${payload.report.quality.overall}  ` +
    `pose y${payload.report.quality.pose.yaw}/p${payload.report.quality.pose.pitch}/r${payload.report.quality.pose.roll}  ` +
    `issues [${payload.report.quality.issues.join(", ") || "none"}]`);
  console.log(`  strengths  ${payload.report.strengths.map((f) => `${f.id}(z${f.z})`).join(", ") || "none"}`);
  console.log(`  weaknesses ${payload.report.weaknesses.map((f) => `${f.id}(z${f.z})`).join(", ") || "none"}`);
  console.log(`  advice     ${payload.report.recommendations.map((r) => `${r.key}←${r.source}`).join(", ") || "none"}`);
  console.log(`\n  dashboard  ${payload.scan.metrics.length} dials, weakest: ${payload.scan.weakest.join(", ")}`);
} catch (err) {
  if (err instanceof VisionError) {
    console.log(`\n${err.kind === "refused" ? "✓" : "✗"} ${err.kind}: ${err.message}`);
    console.log(`  after ${Date.now() - started} ms`);
    // A refusal on the synthetic image is the expected, correct outcome:
    // it proves auth, the model name and the schema were all accepted.
    //
    // `exitCode` rather than `exit()`: exiting while stdout still has
    // buffered writes trips a libuv assertion on Windows, which prints a
    // scary line after an otherwise successful run.
    process.exitCode = err.kind === "refused" && !path ? 0 : 1;
  } else {
    console.error("\n✗ unexpected:", err);
    process.exitCode = 1;
  }
}
