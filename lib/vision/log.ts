// Structured logging for the vision path.
//
// ONE RULE, AND IT IS THE REASON THIS IS A MODULE RATHER THAN console.log
// SCATTERED AROUND: no image data, no data URL, no base64, no email and no
// measurement values ever reach a log line. A face photograph in a Vercel
// log is a photograph the user never consented to store, and the landing
// page's "photos never leave your browser" claim is already stretched by
// sending them to OpenAI at all.
//
// What is logged is operational only: which stage, how long, how many
// tokens, which error class, the SHA-256 PREFIX of the image (8 hex chars —
// enough to correlate two log lines from one request, far too short to
// reverse anything).

type Level = "debug" | "info" | "warn" | "error";

const ENABLED = process.env.VISION_LOG !== "off";
const DEBUG = process.env.VISION_LOG === "debug";

export interface LogFields {
  requestId?: string;
  /** First 8 hex chars of the image hash. Never the full hash. */
  imageRef?: string;
  stage?: string;
  attempt?: number;
  ms?: number;
  status?: number;
  model?: string;
  cache?: "hit" | "miss";
  inputTokens?: number;
  outputTokens?: number;
  /** Error CLASS, not the message — messages can echo request content. */
  errorKind?: string;
  repaired?: number;
  overall?: number;
  [key: string]: unknown;
}

function emit(level: Level, event: string, fields: LogFields) {
  if (!ENABLED) return;
  if (level === "debug" && !DEBUG) return;

  const line = { t: new Date().toISOString(), level, event, ...fields };
  const text = `[vision] ${JSON.stringify(line)}`;
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const log = {
  debug: (event: string, fields: LogFields = {}) => emit("debug", event, fields),
  info: (event: string, fields: LogFields = {}) => emit("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => emit("warn", event, fields),
  error: (event: string, fields: LogFields = {}) => emit("error", event, fields),
};

/** Short, non-reversible reference to an image, for correlating log lines. */
export const imageRef = (sha256: string) => sha256.slice(0, 8);

/** A request id that survives across the retry loop. */
export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}
