import type { BandId, CategoryId, MetricId, PlanId, RowId } from "@/lib/metrics";

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
    /** Index-aligned with QUIZ_STEPS. `options` is absent on number steps. */
    questions: Array<{ title: string; sub?: string; options?: string[] }>;
    numberHint: string;
    next: string;
    skip: string;
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

    /* ---- The redesigned report ------------------------------------------ */
    /** Header pill. States a property of the page, not an action. */
    confidential: string;
    /** Label above the detection state, on the scan stage. */
    status: string;
    faceDetected: string;
    scanId: string;
    scanDate: string;
    detailed: string;
    /** Shown in place of a score when a module could not be evaluated. */
    notMeasured: string;
    strengthsTitle: string;
    optimizeTitle: string;
    potential: string;
    /** One line under the ring: what the figure is. */
    potentialBody: string;
    /** The full derivation, revealed by the info control. */
    potentialWhat: string;
    tipTitle: string;
    tipBody: string;
    moreTips: string;
    /** Accessible name for the floating tab bar. */
    tabsLabel: string;
    tabs: Record<"result" | "analysis" | "tips" | "history", string>;
    /** Why there is only ever one scan in the history. */
    historyBody: string;
    newScan: string;
    /** Row labels for the detailed analysis. */
    modules: Record<RowId, string>;
  };
  plans: Record<
    "raw" | "pro" | "blueprint",
    {
      name: string;
      tagline: string;
      features: string[];
      /** Shown struck through with a cross — what this plan does NOT include. */
      excluded: string[];
    }
  >;
  monthly: {
    title: string;
    sub: string;
    weekLabel: string;
    upsellTitle: string;
    upsellBody: string;
    upsellCta: string;
  };
  checkout: {
    eyebrow: string;
    choosePlan: string;
    continueToPayment: string;
    popular: string;
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
  auth: {
    title: string;
    sub: string;
    emailPlaceholder: string;
    sendCode: string;
    sending: string;
    codeTitle: string;
    codeSub: string; // contains {email}
    verify: string;
    verifying: string;
    resend: string;
    resendIn: string; // contains {s}
    changeEmail: string;
    devHint: string;
    privacy: string;
    errors: {
      invalidEmail: string;
      cooldown: string;
      rateLimited: string;
      unconfigured: string;
      failed: string;
      wrongCode: string; // contains {n}
      expired: string;
      locked: string;
    };
  };
  pay: {
    summaryTitle: string;
    net: string;
    vat: string; // contains {rate}
    shipping: string;
    shippingFree: string;
    total: string;
    inclVat: string; // contains {rate}
    terms: string; // contains {terms} and {privacy} link markers
    termsLink: string;
    privacyLink: string;
    withdrawal: string;
    withdrawalLink: string;
    mustAccept: string;
    orderButton: string;
    processing: string;
    confirming: string;
    succeeded: string;
    expressOr: string;
    securedBy: string;
    unconfigured: string;
    errors: {
      declined: string;
      insufficientFunds: string;
      expiredCard: string;
      incorrectCvc: string;
      processingError: string;
      authRequired: string;
      network: string;
      generic: string;
      timeout: string;
    };
  };
  quality: {
    label: string;
    low: string;
    issues: Record<
      | "blurry"
      | "motionBlur"
      | "underexposed"
      | "overexposed"
      | "noisy"
      | "colorCast"
      | "lowResolution"
      | "notFrontal"
      | "occluded",
      string
    >;
  };
  /** Header link to /konto, and the discreet footer link to the editor. */
  navAccount: string;
  navAdmin: string;
  /** The customer profile at /konto. */
  account: {
    title: string;
    loading: string;
    signedOutBody: string;
    signIn: string;
    signOut: string;
    /** On the report, once the scan has actually been filed. */
    savedBody: string;
    /** On the report, when it has not — so the copy never over-claims. */
    teaserBody: string;
    scansTitle: string;
    noScans: string;
    paymentsTitle: string;
    noPayments: string;
    newScan: string;
  };
  /** The affiliate block on the paid report. */
  products: {
    title: string;
    topBadge: string;
    othersTitle: string;
    /** Contains {host} — the merchant, read off the link. */
    cta: string;
    ctaGeneric: string;
    matchedFor: string;
    priceNote: string;
    /** Advertising disclosure. Legally required, not decorative. */
    disclosure: string;
  };
  /** The catalogue editor. Owner-facing, but typed like everything else. */
  admin: {
    title: string;
    productsLabel: string;
    newProduct: string;
    editProduct: string;
    save: string;
    saving: string;
    cancel: string;
    edit: string;
    delete: string;
    confirmDelete: string;
    loading: string;
    empty: string;
    inactive: string;
    /** Shown beside the count when the catalogue lives in a spreadsheet. */
    backingSheets: string;
    memoryWarning: string;
    fieldTitle: string;
    fieldDescription: string;
    fieldPrice: string;
    priceHint: string;
    fieldImage: string;
    fieldLink: string;
    fieldTags: string;
    tagsHint: string;
    fieldActive: string;
    activeHint: string;
  };
  session: { notice: string };
  status: Record<"in" | "below" | "above", string>;
  statusShort: Record<"in" | "below" | "above", string>;
  categories: Record<CategoryId, { label: string; blurb: string }>;
  metrics: Record<MetricId, { label: string; note: string }>;
  bands: Record<BandId, { label: string; blurb: string }>;
  plan: Record<
    PlanId,
    {
      title: string;
      detail: string;
      tag: string;
      cadence: string;
      /**
       * Two to four words, for the optimisation column on the report, where
       * a half-width card cannot hold the full title. Same advice, not a
       * different one — the long form is still what the action plan shows.
       */
      short: string;
    }
  >;
}
