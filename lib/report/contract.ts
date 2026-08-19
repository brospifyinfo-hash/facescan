// The deep-dive report's contract with the model.
//
// STRUCTURED, NOT MARKDOWN. The report used to come back as a Markdown
// document and was rendered as raw preformatted text — the customer paid
// 18,95 and received a wall of asterisks. A JSON document with named
// sections lets the page typeset the report in the house style, makes
// "did the model deliver everything" a checkable question, and the
// transport's strict mode guarantees the shape (lib/vision/openai.ts
// already reads structured output correctly — the output_text-is-empty
// trap is handled there).
//
// THE LANGUAGE IS THE CUSTOMER'S. The old prompt never named one, so every
// report came back in English regardless of who was reading. As with the
// style studio: a field the model should write in the customer's language
// has to SAY so explicitly, per field group, or the model drifts.
//
// Shared by the route and by scripts/smoke-report.mts, so the live smoke
// test exercises exactly the prompt and validation that production runs.

import type { Locale } from "@/lib/i18n/types";

export interface ReportMeasurement {
  /** The measurement or area, named in the customer's language. */
  area: string;
  /** What this reading means for THIS face, one or two sentences. */
  note: string;
}

export interface ReportFocus {
  title: string;
  /** Why this is a lever, grounded in the photo or a metric. */
  why: string;
  /** The concrete thing to do about it. */
  action: string;
}

export interface ReportWeek {
  theme: string;
  steps: string[];
}

export interface DeepDiveReport {
  overview: string;
  measurements: ReportMeasurement[];
  strengths: string[];
  focus: ReportFocus[];
  weeks: ReportWeek[];
  closing: string;
}

const str = { type: "string" } as const;

const focusItem = {
  type: "object",
  additionalProperties: false,
  required: ["title", "why", "action"],
  properties: { title: str, why: str, action: str },
} as const;

const weekItem = {
  type: "object",
  additionalProperties: false,
  required: ["theme", "steps"],
  properties: { theme: str, steps: { type: "array", items: str } },
} as const;

/**
 * Strict Structured Outputs: every property required, no additional ones,
 * no length keywords (the API rejects them). "EXACTLY THREE focus areas"
 * and "EXACTLY FOUR weeks" are therefore modelled as objects with required
 * keys, not as arrays — the same trick the 25 measurements and the two
 * hairstyles use: the count becomes an API-level guarantee instead of a
 * runtime surprise. validateReport() flattens them back to arrays.
 */
export const REPORT_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "deep_dive_report",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["overview", "measurements", "strengths", "focus", "weeks", "closing"],
    properties: {
      overview: str,
      measurements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["area", "note"],
          properties: { area: str, note: str },
        },
      },
      strengths: { type: "array", items: str },
      focus: {
        type: "object",
        additionalProperties: false,
        required: ["first", "second", "third"],
        properties: { first: focusItem, second: focusItem, third: focusItem },
      },
      weeks: {
        type: "object",
        additionalProperties: false,
        required: ["week1", "week2", "week3", "week4"],
        properties: { week1: weekItem, week2: weekItem, week3: weekItem, week4: weekItem },
      },
      closing: str,
    },
  },
} as const;

const LANGUAGE_NAMES: Record<Locale, string> = {
  de: "German",
  en: "English",
  es: "Spanish",
  fr: "French",
};

export function reportSystemPrompt(locale: Locale): string {
  const language = LANGUAGE_NAMES[locale] ?? "German";
  return `You are a facial-aesthetics coach writing a personalized deep-dive report.
You receive one or two photos (front, and optionally a side profile),
on-device geometric measurements (0-100 heuristic scores plus canthal tilt in
degrees), and the customer's quiz answers.

RULES
- Write EVERY user-facing string in ${language}. All of them, no exceptions.
- Be honest and specific, but constructive and respectful. Never demean.
- No medical or dermatological diagnoses. For skin or hair concerns that look
  clinical, recommend seeing a professional.
- Ground every observation in what is actually visible in the photos or
  present in the measurements. Name what you see; never write filler that
  would fit any face.
- Do not invent numeric ratings beyond the provided metrics.

WHAT EACH FIELD MUST CONTAIN
- overview: two or three sentences summarising the overall picture — the
  honest headline of this face, and the single biggest opportunity.
- measurements: the six to nine MOST MEANINGFUL readings for this face, each
  with what that reading means for this person in plain language. Skip
  metrics that say nothing interesting here. TRANSLATE the metric names into
  ${language} too — the incoming labels are internal English names, not copy.
- strengths: three to five features that genuinely work well, each specific
  enough that the customer can recognise it in the mirror.
- focus (first, second, third): the three biggest realistic levers, ordered
  by impact. "why" grounds the choice in a photo observation or a
  measurement; "action" is the concrete thing to do, not a platitude.
- weeks (week1 to week4): each has a theme and three to five concrete
  steps. Across the four weeks, cover: skincare (morning/evening), jawline
  and posture work, grooming and hairstyle, and lifestyle (sleep, hydration,
  training). Build week on week rather than repeating.
- closing: one or two encouraging sentences, no fluff, no repetition of the
  overview.`;
}

export function reportInstruction(
  quiz: unknown,
  metrics: unknown,
  hasSide: boolean,
): string {
  return [
    `Quiz answers:\n${JSON.stringify(quiz, null, 2)}`,
    `\nOn-device scan metrics:\n${JSON.stringify(metrics, null, 2)}`,
    `\nWrite the personalized report now. The first image is the front profile${
      hasSide ? ", the second is the side profile" : " (no side profile provided)"
    }.`,
  ].join("\n");
}

/** What the schema above actually returns, before flattening. */
interface RawReport {
  overview?: unknown;
  measurements?: unknown;
  strengths?: unknown;
  focus?: { first?: unknown; second?: unknown; third?: unknown };
  weeks?: { week1?: unknown; week2?: unknown; week3?: unknown; week4?: unknown };
  closing?: unknown;
}

/**
 * Flattens the count-guaranteeing objects back to arrays and enforces the
 * bounds strict mode cannot: non-empty strings, sane caps, and the minimum
 * substance under which a "deep dive" would be a hollow document shipped to
 * someone who paid for exactly that depth.
 */
export function validateReport(raw: unknown): DeepDiveReport | null {
  const r = raw as RawReport | null;
  if (!r || typeof r !== "object") return null;

  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : null;

  const overview = text(r.overview, 1200);
  const closing = text(r.closing, 600);
  if (!overview || !closing) return null;

  const measurements = (Array.isArray(r.measurements) ? r.measurements : [])
    .map((m) => {
      const area = text((m as ReportMeasurement)?.area, 80);
      const note = text((m as ReportMeasurement)?.note, 500);
      return area && note ? { area, note } : null;
    })
    .filter((m): m is ReportMeasurement => m !== null)
    .slice(0, 10);

  const strengths = (Array.isArray(r.strengths) ? r.strengths : [])
    .map((s) => text(s, 300))
    .filter((s): s is string => s !== null)
    .slice(0, 6);

  const readFocus = (f: unknown): ReportFocus | null => {
    const title = text((f as ReportFocus)?.title, 90);
    const why = text((f as ReportFocus)?.why, 500);
    const action = text((f as ReportFocus)?.action, 500);
    return title && why && action ? { title, why, action } : null;
  };
  const focus = [r.focus?.first, r.focus?.second, r.focus?.third]
    .map(readFocus)
    .filter((f): f is ReportFocus => f !== null);

  const readWeek = (w: unknown): ReportWeek | null => {
    const theme = text((w as ReportWeek)?.theme, 120);
    const steps = (Array.isArray((w as ReportWeek)?.steps) ? (w as ReportWeek).steps : [])
      .map((s) => text(s, 300))
      .filter((s): s is string => s !== null)
      .slice(0, 6);
    return theme && steps.length > 0 ? { theme, steps } : null;
  };
  const weeks = [r.weeks?.week1, r.weeks?.week2, r.weeks?.week3, r.weeks?.week4]
    .map(readWeek)
    .filter((w): w is ReportWeek => w !== null);

  if (measurements.length < 3 || strengths.length < 2 || focus.length < 3 || weeks.length < 4) {
    return null;
  }

  return { overview, measurements, strengths, focus, weeks, closing };
}
