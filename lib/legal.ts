// Wer diese Seite betreibt — an genau einer Stelle.
//
// Impressum, AGB, Widerrufsbelehrung und Datenschutzerklärung nennen alle
// dieselben Daten. Stünden sie viermal im Markup, würden sie beim ersten
// Umzug dreimal richtig und einmal falsch sein, und die falsche Fassung wäre
// die, die abgemahnt wird. Also einmal hier, überall gelesen.

/** Die Betreiber. Zwei natürliche Personen, gemeinsam. */
export const OPERATORS = ["Bawer Mohamad", "Devid Kasbeitzer"] as const;

export const ADDRESS = {
  street: "Killiansgasse 8",
  zip: "90518",
  city: "Altdorf bei Nürnberg",
  country: "Deutschland",
} as const;

/**
 * ⚠️ MUSS VOR DEM ERSTEN VERKAUF EIN POSTFACH HABEN, DAS MAIL ANNIMMT.
 *
 * §5 DDG verlangt eine Adresse, die eine "schnelle elektronische
 * Kontaktaufnahme" ermöglicht — eine, die Post annimmt und gelesen wird.
 * Für malookai.com ist derzeit KEIN MX-Eintrag gesetzt, an diese Adresse
 * kann also nichts zugestellt werden. Entweder ein Postfach einrichten und
 * den MX-Eintrag in der Vercel-DNS-Verwaltung nachtragen, oder hier eine
 * Adresse eintragen, die heute schon erreichbar ist.
 *
 * Dieselbe Adresse steht in der Widerrufsbelehrung: dorthin richtet der
 * Kunde seinen Widerruf. Kommt sie nicht an, läuft die Frist nicht an.
 */
export const CONTACT_EMAIL = "kontakt@malookai.com";

/**
 * Umsatzsteuer-Identifikationsnummer, falls vorhanden.
 *
 * null bedeutet: es wird keine ausgewiesen. Wer die Kleinunternehmerregelung
 * nach §19 UStG nutzt, hat keine und weist auch keine Umsatzsteuer aus —
 * dann muss allerdings auch die Preisdarstellung im Checkout angepasst
 * werden, die derzeit 19 % ausweist (siehe lib/stripe/server.ts).
 */
export const VAT_ID: string | null = null;

/** Wann die Texte zuletzt inhaltlich geändert wurden. */
export const LEGAL_UPDATED = "27. August 2026";

/** Die Betreiber als eine Zeile: "A und B". */
export const operatorLine = (): string =>
  OPERATORS.length === 2
    ? `${OPERATORS[0]} und ${OPERATORS[1]}`
    : OPERATORS.join(", ");

/** Anschrift als Zeilen, für Adressblöcke. */
export const addressLines = (): string[] => [
  ADDRESS.street,
  `${ADDRESS.zip} ${ADDRESS.city}`,
  ADDRESS.country,
];
