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
    disclaimer:
      "FaceScan provides geometric estimates for self-improvement guidance. It is not a medical device, and no result constitutes a medical or dermatological assessment.",
  },
  quiz: {
    progress: "Question {n} of {total}",
    back: "Back",
    home: "Home",
    minorTitle: "FaceScan is 18+",
    minorBody:
      "Your facial structure is still changing — any score we gave you today would be wrong within a year, and we don't analyze minors' faces on principle. Come back when you're 18.",
    minorCta: "Back to start",
    questions: [
      {
        title: "How should we calibrate your scan?",
        sub: "Facial reference ranges differ — this sets the right baseline.",
        options: ["Male", "Female"],
      },
      { title: "How old are you?", options: ["Under 18", "18–24", "25–34", "35+"] },
      {
        title: "What bothers you most about your face?",
        options: ["Asymmetry", "Weak jawline", "Eye area", "Skin quality", "Thinning hair"],
      },
      {
        title: "Estimated body-fat percentage?",
        sub: "Facial definition correlates strongly with body fat.",
        options: ["Under 12%", "12–18%", "19–25%", "Over 25%", "Not sure"],
      },
      {
        title: "Do you practice tongue posture (mewing)?",
        options: ["Never", "Sometimes", "Every day"],
      },
      {
        title: "What's your ultimate goal?",
        options: ["Model-tier looks", "Dating confidence", "General self-improvement", "Just curious"],
      },
    ],
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
    outOf: "out of 10",
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
  },
  checkout: {
    eyebrow: "One-time unlock",
    product: "Full Biometric Analysis",
    once: "once · no subscription",
    features: [
      "All 16 biometric measurements unlocked",
      "Symmetry, canthal tilt & jawline in exact figures",
      "Personalized glow-up action plan",
      "AI deep-dive report from your photos",
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
    eyeSpacing: {
      label: "Eye spacing",
      note: "Gap between the eyes measured in eye-widths. The classical canon is exactly one.",
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
      label: "Gonial angle",
      note: "The angle the jaw turns at the gonion. Tighter angles read as sharper, though body fat masks this heavily.",
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
  bands: {
    exceptional: {
      label: "Exceptional",
      blurb:
        "Top-band geometry across nearly every measurement. Your levers are refinement, not correction.",
    },
    strong: {
      label: "Strong",
      blurb:
        "Comfortably above the reference range. A few targeted fixes go a long way from here.",
    },
    solid: {
      label: "Solid",
      blurb: "A good baseline with clear, addressable upside.",
    },
    reference: {
      label: "Reference Range",
      blurb:
        "Squarely typical — which is exactly where the biggest visible gains live.",
    },
    developing: {
      label: "Developing",
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
    },
    guaSha: {
      title: "Gua sha along the jaw and under the eyes",
      detail:
        "Two sessions a week, light oil, gentle upward strokes from chin to ear. It moves lymphatic fluid — expect a de-puffing effect that lasts hours, not bone remodelling.",
      tag: "Jawline",
      cadence: "2× / week",
    },
    tonguePosture: {
      title: "Daily tongue-posture habit",
      detail:
        "Full tongue on the palate, lips closed, nasal breathing. Evidence for adult bone change is thin — treat it as posture work. Chew evenly on both sides.",
      tag: "Jawline",
      cadence: "Daily",
    },
    retinoid: {
      title: "Retinoid at night, 3 nights a week",
      detail:
        "Start with adapalene 0.1% or retinol 0.3% on dry skin after cleansing, moisturizer on top. Build to nightly over 8–12 weeks. Going stronger faster only buys irritation.",
      tag: "Skin",
      cadence: "3 nights / week",
    },
    spf: {
      title: "SPF 30+ every single morning",
      detail:
        "The highest-return skin intervention there is, and the one people skip. It protects everything else you do — including the retinoid, which makes skin sun-sensitive.",
      tag: "Skin",
      cadence: "Daily",
    },
    asymmetry: {
      title: "Audit your asymmetry drivers",
      detail:
        "Alternate your chewing side, stop sleeping face-down on the same cheek, and fix screen height so your head isn't tilted for eight hours a day. Small levers — but the ones you control.",
      tag: "Symmetry",
      cadence: "Ongoing",
    },
    depuff: {
      title: "De-puff protocol for the eye area",
      detail:
        "Cut evening sodium, hold 7.5h+ of sleep, moderate alcohol, and sleep with your head slightly elevated. Most eye-area complaints are fluid retention, not bone structure.",
      tag: "Eyes",
      cadence: "Daily",
    },
    proportions: {
      title: "Style around your proportions, don't fight them",
      detail:
        "Vertical proportions are bone and won't change. A haircut with the right height and a beard line that lengthens or widens the lower third shifts the read far more than any exercise.",
      tag: "Proportions",
      cadence: "Next cut",
    },
    hair: {
      title: "Hair loss: act early, see a doctor",
      detail:
        "Minoxidil and finasteride are the only interventions with solid evidence, and both work best before visible thinning. Book a consult rather than experimenting with supplements.",
      tag: "Hair",
      cadence: "This month",
    },
    grooming: {
      title: "Grooming pass with a real barber",
      detail:
        "A cut matched to your face shape, brows cleaned up rather than sculpted, and a consistent beard line. Cheapest, fastest, most visible change on this list.",
      tag: "Grooming",
      cadence: "Every 4 weeks",
    },
    sleep: {
      title: "Sleep is the multiplier",
      detail:
        "7.5–9 hours on a consistent schedule. Skin repair, fluid balance, and general facial freshness all track sleep more tightly than any product in your cabinet.",
      tag: "Lifestyle",
      cadence: "Nightly",
    },
  },
};
