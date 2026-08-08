// Privacy copy that depends on which engine is scoring.
//
// WHY THIS FILE HAD TO EXIST
// --------------------------
// The landing page's central claim is architectural, not a policy promise:
// "your photo never leaves this device". With the on-device engine that is
// exactly true — there is no upload endpoint in the free scan at all.
//
// Turning on NEXT_PUBLIC_SCORE_ENGINE=vision makes it false. The free scan
// then posts both photographs to /api/vision-scan, which forwards them to
// OpenAI. Leaving the old wording in place would not be a stale string; it
// would be telling every visitor something untrue about where their face
// ends up, on the one subject where a product like this has to be exact.
//
// So the claim is switched with the engine rather than softened for
// everyone. A deployment running on geometry keeps the strong, true
// version; a deployment running on vision states plainly what happens.
//
// The 15-minute session expiry and the "no disk, no cookies, no account"
// points survive both modes — those are still true, because the photos are
// still only ever in the tab's memory locally.

import type { Locale } from "./types";

/** The engine flag, read the same way lib/vision and /scan read it. */
export const VISION_ACTIVE = process.env.NEXT_PUBLIC_SCORE_ENGINE === "vision";

export interface PrivacyCopy {
  /** steps[1].text on the landing page. */
  step: string;
  /** steps[2].title — "on-device scan" stops being what happens. */
  scanStepTitle: string;
  scanStepText: string;
  /** trust[0] — the hero badge, the first claim a visitor reads. */
  trustTitle: string;
  trustText: string;
  title: string;
  body: string;
  points: string[];
  /** The "what happens to my photos" FAQ answer. */
  faq: string;
}

/**
 * What the page says when the vision engine is active.
 *
 * Deliberately not hedged. "Encrypted in transit", "trusted provider" and
 * "we never store them" are the phrasings that make a disclosure sound like
 * a reassurance; what a reader needs is the destination and the retention,
 * in one sentence, before they upload anything.
 */
const VISION: Record<Locale, PrivacyCopy> = {
  de: {
    step: "Frontal & Profil. Für die Analyse werden sie einmalig an OpenAI übertragen.",
    scanStepTitle: "Analyse durch GPT-4.1",
    scanStepText: "478 Landmarken lokal, die Bewertung durch das Vision-Modell.",
    trustTitle: "Fotos werden nicht gespeichert",
    trustText:
      "Die Fotos gehen einmalig zur Analyse an OpenAI. Gespeichert werden sie weder bei uns noch dort — und in deinem Tab verfallen sie automatisch.",
    title: "Wohin dein Foto geht",
    body:
      "Die Analyse läuft bei OpenAI (GPT-4.1), nicht in deinem Browser. Deine beiden Fotos werden dafür einmalig übertragen, verkleinert und ohne Namen oder Konto. Sie werden weder bei uns noch zum Training bei OpenAI gespeichert. Das Landmarken-Netz, das du über dem Foto siehst, wird weiterhin lokal berechnet.",
    points: [
      "Die Fotos werden zur Analyse an OpenAI übertragen — das ist der einzige Ort, an den sie gehen.",
      "Auf unserer Seite liegen sie nur im Speicher des Tabs: keine Festplatte, keine Cookies, kein Konto.",
      "Die Sitzung löscht sich nach 15 Minuten selbst, Tab schließen löscht sofort.",
    ],
    faq:
      "Sie werden für die Analyse einmalig an OpenAI übertragen und danach weder bei uns gespeichert noch zum Training verwendet. Auf unserer Seite liegen sie nur im Speicher deines Tabs und sind nach 15 Minuten weg.",
  },
  en: {
    step: "Front & side. They're sent once to OpenAI for the analysis.",
    scanStepTitle: "Analysis by GPT-4.1",
    scanStepText: "478 landmarks locally, the rating from the vision model.",
    trustTitle: "Photos never stored",
    trustText:
      "The photos go to OpenAI once for the analysis. Neither we nor they keep them — and in your tab they auto-expire.",
    title: "Where your photo goes",
    body:
      "The analysis runs at OpenAI (GPT-4.1), not in your browser. Your two photos are sent there once, downscaled, with no name and no account attached. They are not stored by us and not used for training by OpenAI. The landmark mesh you see over the photo is still computed locally.",
    points: [
      "The photos are sent to OpenAI for the analysis — that is the only place they go.",
      "On our side they live in the tab's memory only: no disk, no cookies, no account.",
      "The session clears itself after 15 minutes, and closing the tab clears it instantly.",
    ],
    faq:
      "They are sent to OpenAI once for the analysis, then neither stored by us nor used for training. On our side they only ever live in your tab's memory and are gone after 15 minutes.",
  },
  es: {
    step: "Frontal y perfil. Se envían una vez a OpenAI para el análisis.",
    scanStepTitle: "Análisis con GPT-4.1",
    scanStepText: "478 puntos en local; la valoración, del modelo de visión.",
    trustTitle: "Las fotos no se almacenan",
    trustText:
      "Las fotos se envían una vez a OpenAI para el análisis. Ni nosotros ni ellos las guardamos, y en tu pestaña caducan solas.",
    title: "A dónde va tu foto",
    body:
      "El análisis se ejecuta en OpenAI (GPT-4.1), no en tu navegador. Tus dos fotos se envían allí una sola vez, reducidas de tamaño y sin nombre ni cuenta asociada. No las almacenamos nosotros ni OpenAI las usa para entrenar. La malla de puntos que ves sobre la foto se sigue calculando localmente.",
    points: [
      "Las fotos se envían a OpenAI para el análisis: es el único sitio al que van.",
      "Por nuestra parte viven solo en la memoria de la pestaña: sin disco, sin cookies, sin cuenta.",
      "La sesión se borra sola a los 15 minutos, y cerrar la pestaña la borra al instante.",
    ],
    faq:
      "Se envían una sola vez a OpenAI para el análisis y después ni las almacenamos nosotros ni se usan para entrenar. Por nuestra parte solo viven en la memoria de tu pestaña y desaparecen a los 15 minutos.",
  },
  fr: {
    step: "Face et profil. Elles sont envoyées une fois à OpenAI pour l'analyse.",
    scanStepTitle: "Analyse par GPT-4.1",
    scanStepText: "478 points en local, l'évaluation par le modèle de vision.",
    trustTitle: "Photos jamais conservées",
    trustText:
      "Les photos sont envoyées une fois à OpenAI pour l'analyse. Ni nous ni eux ne les conservons, et dans votre onglet elles expirent d'elles-mêmes.",
    title: "Où va votre photo",
    body:
      "L'analyse s'exécute chez OpenAI (GPT-4.1), pas dans votre navigateur. Vos deux photos y sont envoyées une seule fois, redimensionnées, sans nom ni compte associé. Elles ne sont ni conservées par nous ni utilisées pour l'entraînement par OpenAI. Le maillage de points affiché sur la photo reste calculé localement.",
    points: [
      "Les photos sont envoyées à OpenAI pour l'analyse : c'est le seul endroit où elles vont.",
      "De notre côté, elles ne vivent que dans la mémoire de l'onglet : pas de disque, pas de cookies, pas de compte.",
      "La session s'efface d'elle-même après 15 minutes, et fermer l'onglet l'efface aussitôt.",
    ],
    faq:
      "Elles sont envoyées une seule fois à OpenAI pour l'analyse, puis ni conservées par nous ni utilisées pour l'entraînement. De notre côté, elles ne vivent que dans la mémoire de votre onglet et disparaissent après 15 minutes.",
  },
};

/** The vision wording, or null when the on-device engine is active. */
export function visionPrivacy(locale: Locale): PrivacyCopy | null {
  return VISION_ACTIVE ? VISION[locale] : null;
}

/** Meta description for app/layout.tsx, which has no locale context. */
export const META_DESCRIPTION = VISION_ACTIVE
  ? "Facial geometry analysis rated by GPT-4.1 Vision. 25 measurements against published anthropometric norms — your photos are sent once for the analysis and never stored."
  : "Clinical-grade facial geometry analysis that runs entirely in your browser. 478 landmarks, 16 real measurements — your photos never leave your device during the free scan.";
