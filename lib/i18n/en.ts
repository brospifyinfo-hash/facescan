import type { Dict } from "./types";

export const en: Dict = {
  nav: { howItWorks: "How it works", language: "Language" },
  landing: {
    badge: "On-device AI · Nothing uploaded during your free scan",
    headline: "Find out where you",
    headlineAccent: "really stand.",
    sub: "Clinical-grade facial geometry analysis that runs entirely in your browser. 478 landmarks. 16 real measurements. A plan you can actually act on.",
    cta: "Start Free Scan",
    ctaNote:
      "Free scan · No account needed to start · One-time payment for the full report",
    expired:
      "Your session expired — as promised, your photos and scan were discarded from memory. Start a fresh scan whenever you like.",
    trust: [
      {
        title: "Photos never uploaded",
        text: "The free scan runs 100% on your device — your photos stay in this browser tab and auto-expire.",
      },
      {
        title: "478-landmark geometry",
        text: "Real measurements — symmetry deviation, canthal tilt in degrees, jaw-contour angles. No guesswork.",
      },
      {
        title: "One-time payment",
        text: "No subscription, no auto-renewal. Pay once for your full report, keep it forever.",
      },
    ],
    stepsTitle: "How it works",
    steps: [
      { title: "Answer 6 questions", text: "60 seconds — calibrates your analysis." },
      { title: "Two photos", text: "Front & side. They never leave your browser." },
      { title: "On-device scan", text: "478 landmarks mapped and measured locally." },
      { title: "Your report", text: "16 measurements, category scores, and a real action plan." },
    ],
    measuredTitle: "What actually gets measured",
    measuredSub:
      "Fifteen measurements from the landmark mesh, each checked against a published anthropometric reference range.",
    privacyTitle: "Your photo never leaves this device",
    privacyBody:
      "This isn't a policy promise — it's how the app is built. The analysis model downloads to your browser and runs there. No upload endpoint is involved in the free scan.",
    privacyPoints: [
      "The scan runs in your browser; there is no server to send photos to.",
      "Photos live in the tab's memory only — no disk, no cookies, no account.",
      "The session clears itself after 15 minutes, and closing the tab clears it instantly.",
    ],
    pricingTitle: "One price, paid once",
    pricingSub: "No subscription, no auto-renewal, no upsell.",
    pricingIncludes: [
      "All 15 biometric measurements with their reference ranges",
      "Category scores and your tier placement",
      "Personalized action plan ordered by projected impact",
      "AI deep-dive report generated from your photos",
    ],
    pricingNote: "The scan and your overall score are free. You only pay to see the detail.",
    faqTitle: "Questions worth asking",
    faq: [
      {
        q: "How accurate is this?",
        a: "The landmark detection is precise — it's the same model used in production computer-vision systems. The interpretation is the softer part: scores compare your measurements to published population reference ranges, and those ranges describe averages, not beauty. Treat the numbers as orientation, not verdict.",
      },
      {
        q: "Is this an attractiveness rating?",
        a: "No. It measures how closely your facial proportions track published reference ranges. That correlates with perceived attractiveness in the research literature, but this specific score has never been validated against attractiveness ratings, and we don't claim it has.",
      },
      {
        q: "What happens to my photos?",
        a: "During the free scan, nothing — they never leave your browser. If you buy the report and explicitly consent, the two photos are transmitted once for the AI analysis and are not stored on the server afterwards.",
      },
      {
        q: "Why do you need a side photo?",
        a: "You don't. Every measurement comes from the front photo. A side shot only gives the AI report a second angle to comment on, so it's optional.",
      },
      {
        q: "Can I use this if I'm under 18?",
        a: "No. Facial structure is still changing, so any score would be wrong within a year, and we don't analyze minors' faces on principle.",
      },
    ],
    ctaFinal: "Run your scan",
    disclaimer:
      "FaceScan provides geometric estimates for self-improvement guidance. It is not a medical device, and no result constitutes a medical, dermatological or psychological assessment.",
    imprint: "Imprint",
    privacyLink: "Privacy",
  },
  quiz: {
    progress: "Question {n} of {total}",
    back: "Back",
    home: "Home",
    minorTitle: "FaceScan is 18+",
    minorBody:
      "Your facial structure is still changing — any score we gave you today would be wrong within a year, and we don't analyze minors' faces on principle. Come back when you're 18.",
    minorCta: "Back to start",
    numberHint: "Drag the slider or type a value",
    next: "Continue",
    skip: "Skip",
    questions: [
      {
        title: "How should we calibrate your scan?",
        sub: "Reference ranges differ by sex — this sets the right baseline.",
        options: ["Male", "Female", "Non-binary", "Prefer not to say"],
      },
      {
        title: "How old are you?",
        sub: "Soft tissue and skin behave differently by decade.",
        options: ["Under 18", "18–24", "25–34", "35–44", "45+"],
      },
      { title: "How tall are you?", sub: "Used together with weight to estimate body composition." },
      { title: "What do you weigh?", sub: "Facial definition tracks body composition more than anything else." },
      {
        title: "Estimated body-fat percentage?",
        sub: "If you're unsure, skip it — height and weight already give us a reading.",
        options: ["Under 12%", "12–18%", "19–25%", "Over 25%", "Not sure"],
      },
      {
        title: "How often do you train?",
        sub: "Training frequency shapes how fast the body-fat lever can move.",
        options: ["Not currently", "1–2× a week", "3–4× a week", "5× or more"],
      },
      {
        title: "How much do you sleep?",
        sub: "Fluid retention and skin repair track sleep more tightly than any product.",
        options: ["Under 6 hours", "6–7 hours", "7–8 hours", "Over 8 hours"],
      },
      {
        title: "Your current skincare routine?",
        options: ["None", "Cleanser and moisturizer", "Actives, SPF, the full routine"],
      },
      {
        title: "Do you smoke or vape?",
        sub: "It shows in skin quality and under-eye tone within a couple of years.",
        options: ["No", "Occasionally", "Daily"],
      },
      {
        title: "What bothers you most about your face?",
        options: ["Asymmetry", "Weak jawline", "Eye area", "Skin quality", "Thinning hair"],
      },
      {
        title: "Do you practice tongue posture (mewing)?",
        options: ["Never", "Sometimes", "Every day"],
      },
      {
        title: "What are you actually after?",
        options: ["Model-tier looks", "Dating confidence", "General self-improvement", "Just curious"],
      },
    ],
  },
  plans: {
    raw: {
      name: "Raw Data",
      tagline: "The numbers, nothing else",
      features: [
        "All 15 biometric measurements",
        "Canthal tilt, symmetry %, jaw angle in exact figures",
        "Reference range for every measurement",
      ],
      excluded: ["Action plan", "4-week programme", "History & tracking"],
    },
    pro: {
      name: "Pro Action Plan",
      tagline: "The numbers, plus what to do about them",
      features: [
        "Everything in Raw Data",
        "Step-by-step glow-up plan, ordered by impact",
        "4-week programme, structured week by week",
        "History & tracking — compare scans over time",
      ],
      excluded: ["Glow-up projections", "Hairstyle & product recommendations"],
    },
    blueprint: {
      name: "The Blueprint",
      tagline: "Everything, plus the visual plan",
      features: [
        "Everything in Pro",
        "Glow-up projections for your target state",
        "Hairstyle recommendations for your face shape",
        "Concrete product picks with links",
        "AI deep-dive report written from your photos",
      ],
      excluded: [],
    },
  },
  monthly: {
    title: "Your 4-week programme",
    sub: "Built from your measurements and your answers. Each week adds to the last.",
    weekLabel: "Week",
    upsellTitle: "4-week programme",
    upsellBody:
      "A week-by-week plan built around your weakest measurements, plus the AI deep-dive report written from your photos.",
    upsellCta: "Add the programme",
  },
  upload: {
    title: "Two photos. That's it.",
    sub: "The scan maps 478 facial landmarks from your front profile; the side profile refines the geometry.",
    tips: [
      "Even, natural light — face a window",
      "Neutral expression, mouth closed",
      "No glasses, hair off the face",
    ],
    front: "Front Profile",
    frontHint: "Look straight into the camera, head level.",
    side: "Side Profile",
    sideHint: "Turn 90° — ear toward the camera.",
    optional: "optional",
    sideSkipNote:
      "The side photo is optional — every measurement comes from the front profile. Adding it just gives the AI report a second angle.",
    added: "added",
    replace: "Replace photo",
    privacy:
      "Photos stay in this browser tab — nothing is uploaded during the free scan.",
    cta: "Start Analysis",
    errType: "Please choose an image file (JPG, PNG, WebP).",
    errSize: "Image is larger than 10 MB — please pick a smaller one.",
  },
  scan: {
    lines: [
      "Loading FaceLandmarker model…",
      "Detecting face region…",
      "Mapping 478 facial landmarks…",
      "Correcting head roll from canthi axis…",
      "Measuring canthal tilt…",
      "Analyzing jawline contour…",
      "Computing bilateral symmetry…",
      "Scoring facial proportions…",
      "Compiling your action plan…",
    ],
    running: "Running locally in your browser — nothing is uploaded.",
    keepOpen: "Keep this tab open until the analysis completes.",
    failedTitle: "Scan failed",
    errNoFace:
      "We couldn't detect a face in your front photo. Use even lighting, face the camera directly, and make sure your whole face is visible.",
    errModel:
      "The on-device analysis model could not be loaded. Check your connection (the model downloads once) and try again.",
    backToPhotos: "Back to photos",
    retry: "Try again",
    front: "Front profile",
    side: "Side profile",
  },
  results: {
    overall: "Overall Score",
    // The reference sets the unit as "/ 10" beside the numeral rather than
    // spelling it out. Notation, so it is the same in every locale.
    outOf: "/ 10",
    demoData: "Demo data",
    landmarks: "Landmarks",
    measured: "Measured",
    inRange: "In range",
    breakdown: "Biometric Breakdown",
    breakdownSub: "Category composites from the full measurement set.",
    symmetry: "Symmetry",
    eyes: "Eyes",
    jaw: "Jaw",
    ratios: "Ratios",
    midface: "Midface",
    allMeasurements: "All Measurements",
    allMeasurementsSub: "The complete data table behind the dials above.",
    skinTitle: "Skin & Hair",
    skinSub:
      "Not derivable from landmark geometry — assessed from your photo by the vision model in your AI report.",
    planTitle: "Your Glow-Up Plan",
    planSub: "Ordered by projected impact for your specific measurements.",
    completed: "Completed",
    inCategoryRange: "{n}/{total} in range",
    unlockTitle: "{n} measurements are ready",
    unlockBody: "Your three biggest opportunities:",
    unlockCta: "Unlock Everything",
    unlockNote: "One-time payment · No subscription · Lifetime access",
    unlockChips: ["👁️ Eye region", "🗿 Jaw & chin", "📐 Ratios", "👃 Midface", "✨ Glow-up plan"],
    unlocked: "Full analysis unlocked",
    disclaimer:
      "Every figure is a geometric measurement computed on your device from facial landmarks, compared against published population reference ranges. Orientation for self-improvement — not a medical, dermatological, or psychological assessment, and not a verdict on anyone's appearance.",
    reference: "ref",
    tableHead: ["Measurement", "Value", "Reference", "Status", "Score"],
    legendBand: "Normal range",
    legendNeedle: "Your value",
    legendScale: "Scale ends",
    ringLegend:
      "Every ring shows the same thing: how close that measurement sits to its reference range, 0–100. Tap one for its exact scale.",
    percentileBetter: "Better than {p}%",
    percentileTop: "Top {n}%",
    percentileCaption:
      "of the modelled comparison distribution, by closeness to the published reference proportions.",
    percentileWhat:
      "Computed from a model of 60,000 faces drawn around published anthropometric means — not a ranking of attractiveness, and not yet based on real users.",
    tierTitle: "Your tier",
    tierSub: "Seven bands by proportion conformity",
    tierNote:
      "The faces differ only in the proportions the scan measures — jaw taper, chin length, midface height. They are not a scale of attractiveness.",

    confidential: "Confidential",
    status: "Status",
    faceDetected: "Face detected",
    scanId: "Scan ID",
    scanDate: "Date",
    detailed: "Detailed analysis",
    notMeasured: "Not measurable",
    strengthsTitle: "Your strengths",
    optimizeTitle: "Room to improve",
    potential: "Potential score",
    potentialBody:
      "Reachable if the measurements you can influence sat at their reference.",
    potentialWhat:
      "Not an estimate: the same score, recomputed with every measurement that behaviour, grooming, posture or the photograph itself genuinely moves set to its reference value. Bone stays where it is — the difference comes only from what you can actually change.",
    tipTitle: "Your tip",
    tipBody:
      "Consistency is the lever. Small daily improvements compound into large results.",
    moreTips: "More tips",
    tabsLabel: "Report navigation",
    tabs: {
      result: "Result",
      analysis: "Analysis",
      tips: "Tips",
      history: "History",
    },
    historyBody:
      "This scan is the only one there is. Your photos and measurements live in this browser tab alone and are discarded when the session expires — which is why nothing older can appear here.",
    newScan: "New scan",
    modules: {
      symmetry: "Symmetry",
      eyes: "Eye region",
      jaw: "Jawline",
      proportions: "Propor­tions",
      nose: "Nose shape",
      lips: "Lips",
      skin: "Skin quality",
      faceShape: "Face shape",
      midface: "Midface",
    },
  },
  checkout: {
    eyebrow: "One-time unlock",
    choosePlan: "Choose your plan",
    continueToPayment: "Continue to payment",
    popular: "Most complete",
    product: "Full Biometric Analysis",
    once: "once · no subscription",
    features: [
      "All 15 biometric measurements unlocked",
      "Symmetry, canthal tilt & jawline in exact figures",
      "Personalized action plan",
      "Lifetime access — one-time payment",
    ],
    emailPlaceholder: "Email for your receipt",
    cardNote: "Card details are entered on the payment page",
    pay: "Pay {price} & unlock",
    processing: "Processing…",
    secure: "Encrypted checkout",
    noCardData: "Card data never touches our servers",
    mockWarning:
      "Development build — this is a checkout mock. No payment is taken and no card details are collected. Wire Stripe before launch.",
    close: "Close checkout",
  },
  report: {
    title: "AI Deep-Dive Report",
    body: "Your full report is generated by Claude Vision from your two photos, your scan measurements and your quiz answers.",
    consent:
      "I agree that my two photos are transmitted once, securely, for AI processing to generate this report. They are not stored on the server after processing.",
    generate: "Generate my full report",
    generating: "Generating your report…",
    oneTime: "One-time transmission, nothing stored",
    errNoPhotos:
      "Your photos are no longer in this browser session (they are never stored). Run a new scan to generate the report.",
    errNetwork: "Network error — please try again.",
  },
  auth: {
    title: "Save your analysis",
    sub: "Enter your email and we'll send a six-digit code. No password to remember, and nothing else is collected.",
    emailPlaceholder: "you@example.com",
    sendCode: "Send code",
    sending: "Sending…",
    codeTitle: "Check your inbox",
    codeSub: "We sent a six-digit code to {email}. It expires in 10 minutes.",
    verify: "Verify",
    verifying: "Verifying…",
    resend: "Send a new code",
    resendIn: "New code in {s}s",
    changeEmail: "Use a different address",
    devHint: "Development mode: no mail provider configured, the code is in the server console.",
    privacy: "Your email is used to sign you in and send your receipt. Nothing else.",
    errors: {
      invalidEmail: "That doesn't look like an email address.",
      cooldown: "Give it a moment before requesting another code.",
      rateLimited: "Too many codes requested. Try again in a few minutes.",
      unconfigured: "Sign-in email isn't configured yet. Set RESEND_API_KEY.",
      failed: "We couldn't send the code. Please try again.",
      wrongCode: "That code isn't right. {n} attempts left.",
      expired: "That code expired. Request a new one.",
      locked: "Too many wrong attempts. Request a new code.",
    },
  },
  pay: {
    summaryTitle: "Order summary",
    net: "Net amount",
    vat: "plus {rate}% VAT",
    shipping: "Shipping",
    shippingFree: "None — digital product",
    total: "Total",
    inclVat: "incl. {rate}% VAT",
    terms: "I accept the {terms} and have read the {privacy}.",
    termsLink: "Terms",
    privacyLink: "Privacy Policy",
    withdrawal:
      "I expressly request that performance begins before the withdrawal period ends. I understand that my {withdrawal} expires once the contract is fully performed.",
    withdrawalLink: "right of withdrawal",
    mustAccept: "Please confirm both points to continue.",
    orderButton: "Order now for a fee",
    processing: "Processing payment…",
    confirming: "Confirming payment…",
    succeeded: "Payment successful — unlocking your analysis.",
    expressOr: "or pay by card",
    securedBy: "Payments handled by Stripe. Card details never touch our servers.",
    unconfigured: "Payments aren't configured yet.",
    errors: {
      declined: "Your bank declined the payment. Try another card or check with them.",
      insufficientFunds: "That card has insufficient funds. Please use another method.",
      expiredCard: "That card has expired. Please check the expiry date.",
      incorrectCvc: "The security code doesn't match. It's on the back of the card.",
      processingError: "Something went wrong processing that. Nothing was charged — please try again.",
      authRequired: "Your bank needs an extra confirmation. Please complete it.",
      network: "Connection problem. Nothing was charged — please try again.",
      generic: "The payment couldn't be completed. Nothing was charged.",
      timeout: "Payment went through; unlocking is taking a moment. Reload in a few seconds.",
    },
  },
  quality: {
    label: "Capture quality",
    low: "Low capture quality — the score is less certain than usual. A sharper, front-on photo in even light will tighten it.",
    issues: {
      motionBlur: "Motion blur",
      blurry: "blurry",
      underexposed: "too dark",
      overexposed: "too bright",
      noisy: "grainy",
      colorCast: "colour cast",
      lowResolution: "low resolution",
      notFrontal: "head turned",
      occluded: "face partly covered",
    },
  },
  session: {
    notice:
      "Private session — your photos & scan are held in this browser only and will be discarded in",
  },
  status: {
    in: "In reference range",
    below: "Below reference range",
    above: "Above reference range",
  },
  statusShort: { in: "In range", below: "Below", above: "Above" },
  categories: {
    eyes: {
      label: "Eye Region",
      blurb: "Tilt, spacing and aperture — the highest-signal area of the face.",
    },
    jaw: {
      label: "Jaw & Chin",
      blurb: "Lower-third structure. The area most responsive to body fat.",
    },
    proportions: {
      label: "Proportions",
      blurb: "How the face divides vertically and horizontally.",
    },
    midface: {
      label: "Nose & Mouth",
      blurb: "Central-third relationships and lip balance.",
    },
  },
  metrics: {
    canthalTilt: {
      label: "Canthal tilt",
      note: "Angle from the inner to the outer eye corner. Positive means the outer corner sits higher.",
    },
    esr: {
      label: "Eye separation ratio",
      note: "Distance between the inner eye corners relative to face width. The neoclassical canon sits near 0.45.",
    },
    eyeAspect: {
      label: "Eye aperture",
      note: "Eye opening height relative to its width. Low values can simply mean you blinked — retake if it looks off.",
    },
    browPosition: {
      label: "Brow position",
      note: "Brow-to-eyelid distance in eye-heights. Lower reads as a more hooded, deeper-set brow.",
    },
    gonialAngle: {
      label: "Jaw contour angle",
      note: "Surface angle from cheekbone to jaw to chin — an approximation of jaw sharpness, not the cephalometric gonial angle. Body fat masks this heavily.",
    },
    jawWidth: {
      label: "Jaw-to-cheek width",
      note: "Jaw width relative to cheekbone width. Too high loses taper; too low reads narrow.",
    },
    chinRatio: {
      label: "Chin-to-philtrum",
      note: "Chin height against the philtrum. The classical target is roughly two to one.",
    },
    thirds: {
      label: "Facial thirds",
      note: "How evenly the face divides into upper, middle and lower thirds. Lower deviation is closer to the canon.",
    },
    fifths: {
      label: "Facial fifths",
      note: "Face width measured in eye-widths. The canon divides the face into five equal vertical fifths.",
    },
    fwhr: {
      label: "fWHR",
      note: "Facial width-to-height ratio — the most studied single metric in facial morphology research.",
    },
    facialIndex: {
      label: "Facial index",
      note: "Overall face height against width. Higher reads long and narrow, lower reads short and broad.",
    },
    mouthNose: {
      label: "Mouth-to-nose width",
      note: "Mouth width in nose-widths. The classical canon puts the mouth about 1.5 times the nose.",
    },
    noseWidth: {
      label: "Nose width",
      note: "Nose width relative to face width — one of the classical horizontal fifths.",
    },
    lipRatio: {
      label: "Lip ratio",
      note: "Lower lip height against upper. Around 1.6 : 1 is the commonly cited aesthetic target.",
    },
    midface: {
      label: "Midface ratio",
      note: "Eye-line to lip distance against eye spacing. Compact midfaces are generally read as more youthful.",
    },
  },
  // Tier names follow the looksmaxxing scale the audience already uses.
  // The blurbs deliberately describe the MEASUREMENTS, because that is what
  // was computed — the scale has never been validated against attractiveness
  // ratings, and `tierNote` says so on screen.
  bands: {
    elite: {
      label: "True Adam",
      blurb:
        "Almost every measurement sits at the centre of its reference range. Rare, and there is little left to correct.",
    },
    exceptional: {
      label: "Chad",
      blurb:
        "Top-band geometry across nearly every measurement. Your levers are refinement, not correction.",
    },
    strong: {
      label: "HTN",
      blurb:
        "Comfortably above the reference range. A few targeted fixes go a long way from here.",
    },
    solid: {
      label: "MTN",
      blurb: "A good baseline with clear, addressable upside.",
    },
    reference: {
      label: "LTN",
      blurb:
        "Squarely typical — which is exactly where the biggest visible gains live.",
    },
    emerging: {
      label: "Sub 5",
      blurb:
        "Several measurements sit just outside their reference range. Those are the cheapest wins on your plan.",
    },
    developing: {
      label: "Sub 3",
      blurb:
        "Plenty of headroom. Start at the top of your plan and work down — the early items move the most.",
    },
  },
  plan: {
    bodyFat: {
      title: "Cut body fat toward 12–18%",
      detail:
        "Facial definition is mostly a body-fat story. Moving toward 12–18% will do more for your jaw and cheekbones than any device or hack on the market.",
      tag: "Jawline",
      cadence: "Ongoing",
      short: "Lower body fat",
    },
    guaSha: {
      title: "Gua sha along the jaw and under the eyes",
      detail:
        "Two sessions a week, light oil, gentle upward strokes from chin to ear. It moves lymphatic fluid — expect a de-puffing effect that lasts hours, not bone remodelling.",
      tag: "Jawline",
      cadence: "2× / week",
      short: "Gua sha along the jaw",
    },
    tonguePosture: {
      title: "Daily tongue-posture habit",
      detail:
        "Full tongue on the palate, lips closed, nasal breathing. Evidence for adult bone change is thin — treat it as posture work. Chew evenly on both sides.",
      tag: "Jawline",
      cadence: "Daily",
      short: "Correct tongue posture",
    },
    retinoid: {
      title: "Retinoid at night, 3 nights a week",
      detail:
        "Start with adapalene 0.1% or retinol 0.3% on dry skin after cleansing, moisturizer on top. Build to nightly over 8–12 weeks. Going stronger faster only buys irritation.",
      tag: "Skin",
      cadence: "3 nights / week",
      short: "Evening retinoid routine",
    },
    spf: {
      title: "SPF 30+ every single morning",
      detail:
        "The highest-return skin intervention there is, and the one people skip. It protects everything else you do — including the retinoid, which makes skin sun-sensitive.",
      tag: "Skin",
      cadence: "Daily",
      short: "Daily sun protection",
    },
    asymmetry: {
      title: "Audit your asymmetry drivers",
      detail:
        "Alternate your chewing side, stop sleeping face-down on the same cheek, and fix screen height so your head isn't tilted for eight hours a day. Small levers — but the ones you control.",
      tag: "Symmetry",
      cadence: "Ongoing",
      short: "Even out asymmetry",
    },
    depuff: {
      title: "De-puff protocol for the eye area",
      detail:
        "Cut evening sodium, hold 7.5h+ of sleep, moderate alcohol, and sleep with your head slightly elevated. Most eye-area complaints are fluid retention, not bone structure.",
      tag: "Eyes",
      cadence: "Daily",
      short: "De-puff the eye area",
    },
    proportions: {
      title: "Style around your proportions, don't fight them",
      detail:
        "Vertical proportions are bone and won't change. A haircut with the right height and a beard line that lengthens or widens the lower third shifts the read far more than any exercise.",
      tag: "Proportions",
      cadence: "Next cut",
      short: "Match hair to face shape",
    },
    hair: {
      title: "Hair loss: act early, see a doctor",
      detail:
        "Minoxidil and finasteride are the only interventions with solid evidence, and both work best before visible thinning. Book a consult rather than experimenting with supplements.",
      tag: "Hair",
      cadence: "This month",
      short: "Hairline and styling",
    },
    grooming: {
      title: "Grooming pass with a real barber",
      detail:
        "A cut matched to your face shape, brows cleaned up rather than sculpted, and a consistent beard line. Cheapest, fastest, most visible change on this list.",
      tag: "Grooming",
      cadence: "Every 4 weeks",
      short: "Define the brows",
    },
    smoking: {
      title: "Drop the nicotine",
      detail:
        "Smoking and vaping degrade collagen and dull under-eye tone. It shows within a couple of years and is partly reversible — nothing else on this list gets undone as fast by carrying on.",
      tag: "Skin",
      cadence: "Starting now",
      short: "Cut down on smoking",
    },
    training: {
      title: "Get resistance training into the week",
      detail:
        "Two to three sessions a week is the floor that makes a cut hold. Lifting keeps the muscle you'd otherwise lose, and that's what preserves the jaw and cheek definition you're cutting for.",
      tag: "Body",
      cadence: "3× / week",
      short: "Start strength training",
    },
    sleep: {
      title: "Sleep is the multiplier",
      detail:
        "7.5–9 hours on a consistent schedule. Skin repair, fluid balance, and general facial freshness all track sleep more tightly than any product in your cabinet.",
      tag: "Lifestyle",
      cadence: "Nightly",
      short: "More and better sleep",
    },
  },
};
