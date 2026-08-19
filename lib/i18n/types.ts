import type { BandId, CategoryId, MetricId, PlanId, RowId } from "@/lib/metrics";
import type { StyleFaceShape, UpkeepLevel } from "@/lib/style/types";
import type { ProblemTag } from "@/lib/products/types";

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
  /** The app home screen at `/`. */
  home: {
    confidential: string;
    badge: string;
    /** Split so the last word can carry the accent colour. */
    headline: string;
    headlineAccent: string;
    sub: string;
    /** Exactly three, index-aligned with the icons in AppHome. */
    chips: [string, string, string];
    cta: string;
    stats: {
      /** Suffix after the scan count, e.g. "Scans". */
      scansUnit: string;
      scansLabel: string;
      avgLabel: string;
      deltaLabel: string;
      potentialLabel: string;
    };
    lastScan: string;
    allScans: string;
    totalScore: string;
    details: string;
    potentialScore: string;
    potentialCaption: string;
    /** Shown in place of the last-scan card when nothing has been scanned. */
    emptyTitle: string;
    emptyBody: string;
    /** Exactly four, index-aligned with the icons in AppHome. */
    tiles: [
      { title: string; sub: string },
      { title: string; sub: string },
      { title: string; sub: string },
      { title: string; sub: string },
    ];
    tipEyebrow: string;
    tipTitle: string;
    tipBody: string;
    tipCta: string;
    /** Marks the example figures shown before the first scan. */
    preview: string;
    /** The product rail, the routine strip and the upgrade banner. */
    products: {
      title: string;
      sub: string;
      seeAll: string;
      categories: Record<"all" | "skin" | "face" | "hair" | "lifestyle", string>;
      /** "What it is for" and "what gets better" — the two lines on a card. */
      purposeLabel: string;
      benefitLabel: string;
      /** Real badges only: the strongest match, and genuinely recent. */
      bestMatch: string;
      isNew: string;
      favourite: string;
      emptyCategory: string;
      /** Exactly four, index-aligned with the icons in ProductShowcase. */
      trust: [
        { title: string; text: string },
        { title: string; text: string },
        { title: string; text: string },
        { title: string; text: string },
      ];
    };
    routine: {
      title: string;
      sub: string;
      cta: string;
      /** Exactly five, index-aligned with the icons in RoutineStrip. */
      steps: [
        { phase: string; title: string; text: string },
        { phase: string; title: string; text: string },
        { phase: string; title: string; text: string },
        { phase: string; title: string; text: string },
        { phase: string; title: string; text: string },
      ];
    };
    upgrade: { title: string; sub: string; cta: string };
    tabsLabel: string;
    tabs: Record<"home" | "scan" | "analysis" | "profile", string>;
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
    /** The reveal that plays once after a purchase. */
    simulationSteps: string[];
    simulationNote: string;
    /** Saving the report as a file. */
    downloadTitle: string;
    downloadBody: string;
    downloadCta: string;
    downloadDone: string;
    /** The hairstyle and projection studio. Blueprint only. */
    style: {
      title: string;
      body: string;
      cta: string;
      analysing: string;
      faceShapeLabel: string;
      shapes: Record<StyleFaceShape, string>;
      upkeep: Record<UpkeepLevel, string>;
      /** "What to say at the counter." */
      barberLabel: string;
      projectionTitle: string;
      /**
       * The qualifier under the projection. Load-bearing, not a footnote:
       * the picture is a generated illustration and the copy has to say so.
       */
      projectionDisclaimer: string;
      rendering: string;
      retry: string;
      save: string;
      again: string;
      /** Contains {n} — pictures left in the allowance. */
      remaining: string;
      errGeneric: string;
      errNotImage: string;
      errSignIn: string;
      errQuota: string;
      /** The server could not confirm the purchase (403 not_entitled). */
      errNotEntitled: string;
    };
    /** Eyebrow labels that group the report into chapters. */
    sections: {
      analysis: string;
      plan: string;
      extras: string;
    };
    /** Short labels for the floating section navigation. */
    nav: {
      result: string;
      analysis: string;
      plan: string;
      extras: string;
    };
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
    /** The two-step rail at the top of the sheet. */
    stepPlan: string;
    stepPay: string;
    /** Reassurance row under the plans. */
    instant: string;
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
    /** The session cookie is missing or expired (401). */
    errSignIn: string;
    /** The server could not confirm the purchase (403 not_entitled). */
    errNotEntitled: string;
    /** Section headings of the structured deep-dive document. */
    secMeasurements: string;
    secStrengths: string;
    secFocus: string;
    secPlan: string;
    /** Contains {n} — the week number in the four-week plan. */
    week: string;
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
    /** Re-poll after a charge whose confirmation is late. Never pays again. */
    checkAgain: string;
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
    /**
     * What improves, one line per problem tag.
     *
     * Keyed by tag rather than written per product: the promise on a card
     * then cannot drift away from the tag that decides where the card is
     * shown. See lib/products/presentation.ts.
     */
    improves: Record<ProblemTag, string>;
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
    /** Shown when the catalogue can be read but not edited from here. */
    readOnlyNotice: string;
    openSheet: string;
    columnsLabel: string;
    memoryWarning: string;
    fieldTitle: string;
    fieldDescription: string;
    fieldImage: string;
    pickImage: string;
    replaceImage: string;
    removeImage: string;
    uploading: string;
    uploadFailed: string;
    uploadNotImage: string;
    /** Shown when no Blob store is connected and the field is a URL box. */
    uploadUnavailable: string;
    fieldLink: string;
    fieldTags: string;
    tagsHint: string;
    fieldActive: string;
    activeHint: string;
    /** The home-page artwork slots. */
    images: {
      title: string;
      body: string;
      reset: string;
      usingDefault: string;
      saved: string;
      loadFailed: string;
      saveFailed: string;
    };
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
