import type { BandId, CategoryId, MetricId, PlanId } from "@/lib/metrics";

// Adding a language = write one dictionary file against the `Dict` type,
// register it in ./index.ts, and add it here. Nothing else changes; the
// type checker will list every string the new file still owes you.
export const LOCALES = ["en", "de", "es", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  de: "🇩🇪",
  es: "🇪🇸",
  fr: "🇫🇷",
};

export interface Dict {
  nav: { howItWorks: string; language: string };
  landing: {
    badge: string;
    headline: string;
    headlineAccent: string;
    sub: string;
    cta: string;
    ctaNote: string;
    expired: string;
    trust: Array<{ title: string; text: string }>;
    stepsTitle: string;
    steps: Array<{ title: string; text: string }>;
    measuredTitle: string;
    measuredSub: string;
    privacyTitle: string;
    privacyBody: string;
    privacyPoints: string[];
    pricingTitle: string;
    pricingSub: string;
    pricingIncludes: string[];
    pricingNote: string;
    faqTitle: string;
    faq: Array<{ q: string; a: string }>;
    ctaFinal: string;
    disclaimer: string;
    imprint: string;
    privacyLink: string;
  };
  quiz: {
    progress: string; // "Question {n} of {total}"
    back: string;
    home: string;
    minorTitle: string;
    minorBody: string;
    minorCta: string;
    questions: Array<{ title: string; sub?: string; options: string[] }>;
  };
  upload: {
    title: string;
    sub: string;
    tips: string[];
    front: string;
    frontHint: string;
    side: string;
    sideHint: string;
    optional: string;
    sideSkipNote: string;
    added: string;
    replace: string;
    privacy: string;
    cta: string;
    errType: string;
    errSize: string;
  };
  scan: {
    lines: string[];
    running: string;
    keepOpen: string;
    failedTitle: string;
    errNoFace: string;
    errModel: string;
    backToPhotos: string;
    retry: string;
    front: string;
    side: string;
  };
  results: {
    overall: string;
    outOf: string;
    demoData: string;
    landmarks: string;
    measured: string;
    inRange: string;
    breakdown: string;
    breakdownSub: string;
    symmetry: string;
    eyes: string;
    jaw: string;
    ratios: string;
    midface: string;
    allMeasurements: string;
    allMeasurementsSub: string;
    skinTitle: string;
    skinSub: string;
    planTitle: string;
    planSub: string;
    completed: string;
    inCategoryRange: string; // "{n}/{total} in range"
    unlockTitle: string; // "{n} measurements are ready"
    unlockBody: string;
    unlockCta: string;
    unlockNote: string;
    unlockChips: string[];
    unlocked: string;
    disclaimer: string;
    reference: string;
    tableHead: string[];
    legendBand: string;
    legendNeedle: string;
    legendScale: string;
    ringLegend: string;
    /** Headline, always meaningful: "Better than {p}%". */
    percentileBetter: string;
    /** Badge, only rendered when the result is genuinely in the upper half. */
    percentileTop: string; // "Top {n}%"
    percentileCaption: string;
    percentileWhat: string;
    tierTitle: string;
    tierSub: string;
    tierNote: string;
  };
  checkout: {
    eyebrow: string;
    product: string;
    once: string;
    features: string[];
    emailPlaceholder: string;
    cardNote: string;
    pay: string;
    processing: string;
    secure: string;
    noCardData: string;
    mockWarning: string;
    close: string;
  };
  report: {
    title: string;
    body: string;
    consent: string;
    generate: string;
    generating: string;
    oneTime: string;
    errNoPhotos: string;
    errNetwork: string;
  };
  session: { notice: string };
  status: Record<"in" | "below" | "above", string>;
  statusShort: Record<"in" | "below" | "above", string>;
  categories: Record<CategoryId, { label: string; blurb: string }>;
  metrics: Record<MetricId, { label: string; note: string }>;
  bands: Record<BandId, { label: string; blurb: string }>;
  plan: Record<
    PlanId,
    { title: string; detail: string; tag: string; cadence: string }
  >;
}
