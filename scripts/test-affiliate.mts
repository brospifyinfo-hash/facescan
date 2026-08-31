// The affiliate programme's money rules, checked without a store behind them.
//
//   npx tsx scripts/test-affiliate.mts
//
// WHAT THIS FILE IS FOR
// ---------------------
// Every number a partner is ever paid comes out of four decisions: which rung
// of the ladder they stand on, what percentage that rung pays, what the
// percentage is applied to, and whether the commission has ripened yet. All
// four are pure functions in lib/affiliate/model.ts precisely so they can be
// run here — a money rule that only exists inside a route handler is a rule
// nobody ever verifies.
//
// The two facts worth stating out loud, because they are what the tests
// enforce:
//
//   * A commission freezes the percent and the level it was booked at. The
//     admin may move the ladder at any time; yesterday's earnings must not
//     move with it.
//
//   * Maturity is DERIVED. There is no cron job that flips "pending" to
//     "available" — effectiveStatus() reads the clock. A sweeper that stops
//     running would leave partners unpaid and nobody would notice for weeks.

import { randomBytes } from "crypto";

// Set before importing anything that reads them: the crypto module resolves
// the key per call, but a test run must never depend on a developer's .env.
process.env.AFFILIATE_PII_KEY = randomBytes(32).toString("base64");
process.env.AUTH_SECRET = "affiliate-test-secret-not-for-production";

const { DEFAULT_CONFIG, DEFAULT_LEVELS, validateConfig, normalizeConfig } = await import(
  "../lib/affiliate/config"
);
const {
  levelFor,
  nextLevel,
  percentFor,
  effectiveStatus,
  payableCents,
  pendingCents,
  commissionAmount,
  baseCentsFor,
  maskEmail,
  affiliateLink,
} = await import("../lib/affiliate/model");
const { normalizeIban, isValidIban, ibanLast4, maskIban, formatIban } = await import(
  "../lib/affiliate/iban"
);
const { piiKeyConfigured, encryptSecret, decryptSecret } = await import("../lib/affiliate/crypto");
const { CODE_ALPHABET, randomCode, normalizeCode } = await import("../lib/affiliate/codes");

import type { Affiliate, AffiliateConfig, Commission, LevelNumber } from "../lib/affiliate/model";
import { AMOUNTS } from "../lib/pricing";

// NUR DIE FREMDWAEHRUNGSPRUEFUNG HAENGT AN DER PREISTABELLE.
//
// bookCommission nimmt einen Euro-Betrag, wie er kommt — die Vorlage unten
// darf deshalb eine feste Zahl benutzen und tut das absichtlich: sie prueft
// Provisionsarithmetik, nicht den Katalog, und alle Erwartungswerte in
// dieser Datei sind aus ihr gerechnet.
//
// Fuer eine FREMDE Waehrung ist das anders. Dort ist die Frage gerade, ob
// der Betrag dem Euro-Preis entspricht (gleiche Zahl, andere Waehrung) oder
// ein umgerechneter ist — und dafuer schaut die Buchung in AMOUNTS. Eine
// eingetippte Zahl liesse diesen einen Test bei jeder Preisaenderung
// fehlschlagen, an einer Stelle, die mit Provisionen nichts zu tun hat.
const CURRENT_BLUEPRINT_CENTS = Math.round(AMOUNTS.blueprint * 100);

let failed = 0;
let checks = 0;
function ok(name: string, cond: boolean, detail = "") {
  checks++;
  if (!cond) failed++;
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const CFG: AffiliateConfig = { ...DEFAULT_CONFIG, levels: DEFAULT_LEVELS.map((l) => ({ ...l })) };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_700_000_000_000;

function commission(over: Partial<Commission> = {}): Commission {
  return {
    id: over.id ?? "pi_test",
    affiliateEmail: "partner@example.com",
    customerEmail: "kunde@example.com",
    plan: "blueprint",
    grossCents: 1895,
    baseCents: 1895,
    percent: 20,
    level: 3,
    amountCents: 379,
    createdAt: NOW - 11 * DAY,
    maturesAt: NOW - DAY,
    status: "pending",
    payoutId: null,
    reversedReason: null,
    ...over,
  };
}

// ---------------------------------------------------------------------------
console.log("\n1 — Die Leiter: 20 / 50 / 100 / 250");

const LADDER: Array<[number, LevelNumber]> = [
  [0, 1], [19, 1], [20, 2], [49, 2], [50, 3],
  [99, 3], [100, 4], [249, 4], [250, 5], [10_000, 5],
];
for (const [count, expected] of LADDER) {
  ok(
    `${count} zahlende Kunden → Level ${expected}`,
    levelFor(count, CFG).level === expected,
    `bekommen: ${levelFor(count, CFG).level}`,
  );
}
ok("Level 1 zahlt 10 %", levelFor(0, CFG).percent === 10);
ok("Level 5 zahlt 30 %", levelFor(250, CFG).percent === 30);
ok("nextLevel von Level 3 ist Level 4", nextLevel(levelFor(50, CFG), CFG)?.level === 4);
ok("nextLevel von Level 5 ist null", nextLevel(levelFor(250, CFG), CFG) === null);
ok(
  "eine unsortiert gespeicherte Leiter wird trotzdem richtig gelesen",
  levelFor(60, { ...CFG, levels: [...CFG.levels].reverse() }).level === 3,
);
ok("negative Kundenzahl kippt nicht unter Level 1", levelFor(-5, CFG).level === 1);

// ---------------------------------------------------------------------------
console.log("\n2 — Geänderte Schwellen greifen sofort");

const STEEP: AffiliateConfig = {
  ...CFG,
  levels: [
    { level: 1, label: "Starter", minReferrals: 0, percent: 5 },
    { level: 2, label: "Bronze", minReferrals: 5, percent: 8 },
    { level: 3, label: "Silber", minReferrals: 10, percent: 12 },
    { level: 4, label: "Gold", minReferrals: 15, percent: 16 },
    { level: 5, label: "Legende", minReferrals: 20, percent: 22 },
  ],
};
ok("5 Kunden reichen bei geänderter Leiter für Level 2", levelFor(5, STEEP).level === 2);
ok("20 Kunden sind dort bereits Level 5", levelFor(20, STEEP).level === 5);
ok("und zahlen die dort hinterlegten 22 %", levelFor(20, STEEP).percent === 22);
ok(
  "dieselbe Kundenzahl ergibt in der Standardleiter weiterhin Level 2",
  levelFor(20, CFG).level === 2 && levelFor(20, CFG).percent === 15,
);

// ---------------------------------------------------------------------------
console.log("\n3 — Overrides schlagen die Konfiguration");

const plain = { percentOverride: null, levelOverride: null };
ok("ohne Override gilt die Leiter", percentFor(plain, CFG, 50) === 20);
ok(
  "levelOverride hebt auf das gesetzte Level",
  percentFor({ percentOverride: null, levelOverride: 5 }, CFG, 0) === 30,
);
ok(
  "percentOverride schlägt auch das Level",
  percentFor({ percentOverride: 42, levelOverride: 5 }, CFG, 250) === 42,
);
ok(
  "ein Override über 50 % wird gekappt, nicht ausgezahlt",
  percentFor({ percentOverride: 90, levelOverride: null }, CFG, 0) === 50,
);
ok(
  "ein negativer Override wird auf 0 gekappt",
  percentFor({ percentOverride: -10, levelOverride: null }, CFG, 0) === 0,
);
ok(
  "levelOverride verändert die Anzeige des Levels mit",
  levelFor(0, CFG, 4).level === 4 && levelFor(0, CFG, 4).percent === 25,
);

// ---------------------------------------------------------------------------
console.log("\n4 — Provisionsbetrag: Basis, Prozente, Rundung");

ok("18,95 € brutto bei 20 % ergibt 379 Cent", commissionAmount(1895, 20) === 379);
ok("brutto-Basis lässt den Betrag unverändert", baseCentsFor(1895, 303, CFG) === 1895);

const NET: AffiliateConfig = { ...CFG, commissionBase: "net" };
ok(
  "netto-Basis nimmt die von Stripe berechnete MwSt.",
  baseCentsFor(1895, 303, NET) === 1592,
  `bekommen: ${baseCentsFor(1895, 303, NET)}`,
);
ok(
  "ohne MwSt.-Angabe wird mit dem konfigurierten Satz gerechnet",
  baseCentsFor(1895, null, NET) === 1592,
  `bekommen: ${baseCentsFor(1895, null, NET)}`,
);
ok("netto-Basis bei 20 % ergibt 318 Cent", commissionAmount(baseCentsFor(1895, 303, NET), 20) === 318);
ok(
  "gerundet wird kaufmännisch, nicht abgeschnitten",
  commissionAmount(195, 15) === 29,
  `0,15 × 195 = 29,25 → 29 (floor wäre ebenfalls 29, aber 0,15 × 197 = 29,55 → ${commissionAmount(197, 15)})`,
);
ok("aufgerundet wird, wo es hingehört", commissionAmount(197, 15) === 30);
ok("eine unsinnige Basis ergibt 0 statt NaN", commissionAmount(Number.NaN, 20) === 0);
ok(
  "eine kaputte MwSt.-Angabe fällt auf die Rechnung zurück",
  baseCentsFor(1895, 5000, NET) === 1592,
  "vatCents >= grossCents ist unmöglich und wird verworfen",
);

// ---------------------------------------------------------------------------
console.log("\n7 — Reifung wird gelesen, nicht geschrieben");

ok(
  "vor dem Reifedatum: pending",
  effectiveStatus(commission({ maturesAt: NOW + DAY }), NOW) === "pending",
);
ok(
  "nach dem Reifedatum: available",
  effectiveStatus(commission({ maturesAt: NOW - 1 }), NOW) === "available",
);
ok(
  "exakt auf die Millisekunde gilt als reif",
  effectiveStatus(commission({ maturesAt: NOW }), NOW) === "available",
);
for (const status of ["requested", "paid", "reversed"] as const) {
  ok(
    `"${status}" bleibt von der Uhr unberührt`,
    effectiveStatus(commission({ status, maturesAt: NOW - DAY }), NOW) === status,
  );
}

const MIXED: Commission[] = [
  commission({ id: "a", amountCents: 379, maturesAt: NOW - DAY }),
  commission({ id: "b", amountCents: 500, maturesAt: NOW + DAY }),
  commission({ id: "c", amountCents: 250, status: "paid" }),
  commission({ id: "d", amountCents: 120, status: "requested" }),
];
ok("auszahlbar ist nur, was gereift und frei ist", payableCents(MIXED, NOW) === 379);
ok("in Reifung ist die noch nicht fällige Zeile", pendingCents(MIXED, NOW) === 500);
ok(
  "ein negativer Ausgleichsposten mindert die Auszahlung",
  payableCents([...MIXED, commission({ id: "rev_a", amountCents: -200, maturesAt: NOW - 1 })], NOW) ===
    179,
);
ok(
  "mehr Storno als Guthaben ergibt 0, nie eine Schuld des Partners",
  payableCents([commission({ id: "rev", amountCents: -900, maturesAt: NOW - 1 })], NOW) === 0,
);

// ---------------------------------------------------------------------------
console.log("\n10 — IBAN: Prüfsumme statt Formgefühl");

ok("eine gültige deutsche IBAN besteht", isValidIban("DE89370400440532013000"));
ok("eine um eine Ziffer verdrehte IBAN fällt durch", !isValidIban("DE89370400440532013001"));
ok(
  "Kleinschreibung und Leerzeichen werden normalisiert",
  isValidIban("de89 3704 0044 0532 0130 00") &&
    normalizeIban("de89 3704 0044 0532 0130 00") === "DE89370400440532013000",
);
ok("eine falsche Länge fällt durch", !isValidIban("DE8937040044053201300"));
ok("Buchstabensalat fällt durch", !isValidIban("HALLOWELT"));
ok("eine leere Eingabe fällt durch", !isValidIban(""));
ok("eine gültige österreichische IBAN besteht", isValidIban("AT611904300234573201"));
ok("eine gültige niederländische IBAN besteht", isValidIban("NL91ABNA0417164300"));
ok("eine gültige britische IBAN besteht", isValidIban("GB29NWBK60161331926819"));
ok("last4 sind die letzten vier Stellen", ibanLast4("DE89 3704 0044 0532 0130 00") === "3000");
ok("maskIban zeigt nur Land und Endziffern", maskIban("DE89370400440532013000") === "DE•• •••• 3000");
ok(
  "maskIban gibt niemals die Kontonummer preis",
  !maskIban("DE89370400440532013000").includes("370400"),
);
ok("formatIban gruppiert in Vierergruppen", formatIban("DE89370400440532013000") === "DE89 3704 0044 0532 0130 00");

// ---------------------------------------------------------------------------
console.log("\n11 — Verschlüsselung der Zahlungsdaten");

ok("mit gesetztem Schlüssel ist die Verschlüsselung verfügbar", piiKeyConfigured());

const IBAN = "DE89370400440532013000";
const token = encryptSecret(IBAN);
ok("Entschlüsseln stellt das Original wieder her", decryptSecret(token) === IBAN);
ok("der Klartext steckt nicht im Chiffretext", !token.includes(IBAN) && !token.includes("370400"));
ok("das Format ist versioniert", token.startsWith("v1."));
ok(
  "zwei Verschlüsselungen desselben Werts sind verschieden",
  encryptSecret(IBAN) !== encryptSecret(IBAN),
  "ein wiederholter IV würde GCM brechen",
);

let threw = false;
try {
  const parts = token.split(".");
  // Ein Bit im Chiffretext kippen: GCM muss das bemerken.
  const ct = Buffer.from(parts[3], "base64url");
  ct[0] ^= 0x01;
  decryptSecret([parts[0], parts[1], parts[2], ct.toString("base64url")].join("."));
} catch {
  threw = true;
}
ok("ein manipulierter Chiffretext wirft", threw);

threw = false;
try {
  decryptSecret("v1.aaa.bbb.ccc");
} catch {
  threw = true;
}
ok("ein unsinniges Token wirft", threw);

const savedKey = process.env.AFFILIATE_PII_KEY;
const savedSecretForPii = process.env.AUTH_SECRET;

// Ohne eigene Variable, aber mit AUTH_SECRET: der Schlüssel wird abgeleitet.
// Das ist der Normalfall im Betrieb — niemand muss etwas zusätzlich setzen.
delete process.env.AFFILIATE_PII_KEY;
ok("ohne eigene Variable wird der Schlüssel aus AUTH_SECRET abgeleitet", piiKeyConfigured());
const derivedToken = encryptSecret(IBAN);
ok("und verschlüsselt wie gewohnt", decryptSecret(derivedToken) === IBAN);

// Wird die eigene Variable später ergänzt, müssen alte Werte weiter aufgehen —
// sonst wäre die Admin-Auszahlungsliste nach einer Env-Änderung leer.
process.env.AFFILIATE_PII_KEY = savedKey;
ok(
  "ein vorher abgelegter Wert öffnet auch nach dem Hinzufügen einer eigenen Variable",
  decryptSecret(derivedToken) === IBAN,
);
ok("neue Werte laufen dann über den eigenen Schlüssel", decryptSecret(encryptSecret(IBAN)) === IBAN);

// Ein zu kurzer eigener Schlüssel darf nicht als Schlüssel durchgehen; da
// AUTH_SECRET weiterhin steht, bleibt die Ableitung als Boden.
process.env.AFFILIATE_PII_KEY = "zu-kurz";
ok("ein zu kurzer eigener Schlüssel wird ignoriert, nicht aufgefüllt", piiKeyConfigured());

// Gar nichts gesetzt: fail-closed, keine Klartext-IBAN.
delete process.env.AFFILIATE_PII_KEY;
delete process.env.AUTH_SECRET;
ok("ohne jeden Schlüssel meldet sich das Modul als nicht konfiguriert", !piiKeyConfigured());
threw = false;
try {
  encryptSecret(IBAN);
} catch {
  threw = true;
}
ok("und speichert NICHT im Klartext, sondern wirft", threw);

process.env.AFFILIATE_PII_KEY = savedKey;
process.env.AUTH_SECRET = savedSecretForPii;

// ---------------------------------------------------------------------------
console.log("\nCodes, Maskierung, Links");

const code = randomCode(6);
ok("ein erzeugter Code hat die verlangte Länge", code.length === 6);
ok(
  "und benutzt nur das verwechslungsarme Alphabet",
  [...code].every((c) => CODE_ALPHABET.includes(c)),
);
ok("I, O, 0 und 1 kommen im Alphabet nicht vor", !/[IO01]/.test(CODE_ALPHABET));
ok(
  "1000 Codes sind praktisch kollisionsfrei",
  new Set(Array.from({ length: 1000 }, () => randomCode(6))).size === 1000,
);
ok("normalizeCode räumt Eingabetippfehler auf", normalizeCode(" abc-234 ") === "ABC234");
ok("normalizeCode ist idempotent", normalizeCode(normalizeCode("abc-234")) === normalizeCode("abc-234"));
ok(
  "normalizeCode faltet keine Buchstaben um",
  normalizeCode("QJLM23") === "QJLM23",
  "Q, J und L sind Teil des Alphabets — eine Umdeutung würde Codes fremden Partnern zuordnen",
);
ok("maskEmail zeigt nur den ersten Buchstaben", maskEmail("max@gmail.com") === "m***@gmail.com");
ok("maskEmail kommt mit einbuchstabigen Adressen klar", maskEmail("a@b.de") === "*@b.de");
ok("maskEmail verrät bei Unsinn gar nichts", maskEmail("keine-adresse") === "***");
ok(
  "der Partnerlink hat genau eine Form",
  affiliateLink("https://facescan.app/", "ABC234") === "https://facescan.app/r/ABC234",
);

// ---------------------------------------------------------------------------
console.log("\nKonfiguration: Validierung und Reparatur");

const valid = validateConfig({ ...CFG, levels: DEFAULT_LEVELS });
ok("die Standardkonfiguration ist gültig", valid.ok);

const fourLevels = validateConfig({ ...CFG, levels: DEFAULT_LEVELS.slice(0, 4) });
ok("vier Level werden abgelehnt", !fourLevels.ok);

const notIncreasing = validateConfig({
  ...CFG,
  levels: DEFAULT_LEVELS.map((l, i) => (i === 3 ? { ...l, minReferrals: 50 } : l)),
});
ok("gleiche Schwellen bei zwei Leveln werden abgelehnt", !notIncreasing.ok);

const level1NotZero = validateConfig({
  ...CFG,
  levels: DEFAULT_LEVELS.map((l, i) => (i === 0 ? { ...l, minReferrals: 3 } : l)),
});
ok("Level 1 muss bei 0 beginnen", !level1NotZero.ok);

const tooMuch = validateConfig({
  ...CFG,
  levels: DEFAULT_LEVELS.map((l, i) => (i === 4 ? { ...l, percent: 80 } : l)),
});
ok("80 % Provision werden abgelehnt", !tooMuch.ok);

const tooPrecise = validateConfig({
  ...CFG,
  levels: DEFAULT_LEVELS.map((l, i) => (i === 1 ? { ...l, percent: 15.25 } : l)),
});
ok("mehr als eine Nachkommastelle wird abgelehnt", !tooPrecise.ok);

const halfPercent = validateConfig({
  ...CFG,
  levels: DEFAULT_LEVELS.map((l, i) => (i === 1 ? { ...l, percent: 15.5 } : l)),
});
ok("15,5 % sind erlaubt", halfPercent.ok);

ok("eine negative Haltefrist wird abgelehnt", !validateConfig({ ...CFG, holdDays: -1 }).ok);
ok("eine Haltefrist von 0 Tagen ist erlaubt", validateConfig({ ...CFG, holdDays: 0 }).ok);
ok("leere Teilnahmebedingungen werden abgelehnt", !validateConfig({ ...CFG, terms: "" }).ok);
ok("ein unbekannter joinMode wird abgelehnt", !validateConfig({ ...CFG, joinMode: "irgendwas" }).ok);
ok(
  "eine ungültige Konfiguration nennt jeden Grund einzeln",
  (() => {
    const res = validateConfig({ ...CFG, holdDays: -1, terms: "", joinMode: "x" });
    return !res.ok && res.errors.length >= 3;
  })(),
);

ok("normalizeConfig macht aus null die Defaults", normalizeConfig(null).payoutMinCents === 2500);
ok(
  "normalizeConfig ergänzt fehlende Felder",
  normalizeConfig({ enabled: false }).holdDays === 10 &&
    normalizeConfig({ enabled: false }).enabled === false,
);
ok(
  "normalizeConfig verwirft eine kaputte Leiter komplett",
  normalizeConfig({ levels: [{ level: 1, label: "x", minReferrals: 99, percent: 1 }] }).levels
    .length === 5,
);
ok(
  "normalizeConfig wirft nie",
  (() => {
    try {
      normalizeConfig("kaputt");
      normalizeConfig(42);
      normalizeConfig([]);
      return true;
    } catch {
      return false;
    }
  })(),
);

// ---------------------------------------------------------------------------
// Store-, Buchungs- und Auszahlungstests (Kriterien 5, 6, 8, 9, 12)
//
// Diese Hälfte fährt gegen den Memory-Store: ohne Upstash- und Sheets-Variablen
// wählt lib/affiliate/store.ts ihn von selbst. Genau die Wege, die im Betrieb
// nur der Stripe-Webhook auslöst, laufen hier deshalb ohne Netz, ohne Stripe
// und ohne Tabelle.
// ---------------------------------------------------------------------------

const { affiliateStore, affiliateBacking } = await import("../lib/affiliate/store");
const { bookCommission, reverseCommission, recomputeSummary, referralMetadataFor } = await import(
  "../lib/affiliate/commission"
);
const { requestPayout, decidePayout } = await import("../lib/affiliate/payouts");
const { bindReferral, signRef, readRef } = await import("../lib/affiliate/track");
const { entitlements } = await import("../lib/stripe/entitlements");

// Die Buchungswege loggen absichtlich viel (jede abgelehnte Provision ist eine
// Zeile). Für den Testlauf werden info/warn eingesammelt statt gedruckt —
// console.error bleibt sichtbar, damit ein echter Fehler nicht untergeht.
const realInfo = console.info;
const realWarn = console.warn;
console.info = () => {};
console.warn = () => {};

ok("die Tests laufen gegen den Memory-Store", affiliateBacking() === "memory", affiliateBacking());

function partnerRecord(email: string, code: string, over: Partial<Affiliate> = {}): Affiliate {
  return {
    email,
    code,
    status: "active",
    firstName: "Max",
    lastName: "Mustermann",
    address: { street: "Musterweg 1", postalCode: "10115", city: "Berlin", country: "DE" },
    ibanEnc: encryptSecret("DE89370400440532013000"),
    ibanLast4: "3000",
    ibanCountry: "DE",
    accountHolder: "Max Mustermann",
    createdAt: NOW,
    approvedAt: NOW,
    invitedWithCode: null,
    percentOverride: null,
    levelOverride: null,
    payoutMinOverrideCents: null,
    note: "",
    history: [],
    ...over,
  };
}

async function makePartner(email: string, code: string, over: Partial<Affiliate> = {}) {
  const aff = partnerRecord(email, code, over);
  await affiliateStore.putAffiliate(aff);
  return aff;
}

async function bindCustomer(customer: string, aff: Affiliate) {
  await affiliateStore.putBinding({
    customerEmail: customer,
    affiliateEmail: aff.email,
    code: aff.code,
    boundAt: Date.now(),
    source: "link",
    firstPurchaseAt: null,
  });
}

/** Ein Intent, wie ihn der Webhook sieht: 18,95 € brutto, 3,03 € MwSt. */
function intentFor(
  id: string,
  customer: string,
  code: string,
  meta: Record<string, string> = {},
) {
  return {
    id,
    amount: 1895,
    currency: "eur",
    metadata: {
      email: customer,
      plan: "blueprint",
      grossMinor: "1895",
      vatMinor: "303",
      ref: code,
      refLevel: "1",
      refPercent: "10",
      ...meta,
    },
  };
}

// ---------------------------------------------------------------------------
console.log("\n5 — Idempotenz: ein Stripe-Replay zahlt nicht zweimal");

const p1 = await makePartner("partner1@example.com", "PARTNA");
await bindCustomer("kunde1@example.com", p1);

await bookCommission(intentFor("pi_1", "kunde1@example.com", p1.code));
await bookCommission(intentFor("pi_1", "kunde1@example.com", p1.code));
await bookCommission(intentFor("pi_1", "kunde1@example.com", p1.code));

const p1Lines = await affiliateStore.listCommissions(p1.email);
const p1Sum = await affiliateStore.getSummary(p1.email);
ok("drei Zustellungen desselben Events ergeben eine Zeile", p1Lines.length === 1, `${p1Lines.length}`);
ok("10 % von 18,95 € sind 190 Cent", p1Lines[0]?.amountCents === 190, `${p1Lines[0]?.amountCents}`);
ok("der Umsatz wird genau einmal gezählt", p1Sum.revenueCents === 1895, `${p1Sum.revenueCents}`);
ok("die Provision wird genau einmal gezählt", p1Sum.earnedCents === 190, `${p1Sum.earnedCents}`);
ok("der Kunde wird genau einmal gezählt", p1Sum.payingCustomers === 1, `${p1Sum.payingCustomers}`);
ok("die Zeile startet in Reifung", p1Lines[0]?.status === "pending");
ok(
  "das Reifedatum liegt 10 Tage in der Zukunft",
  Math.abs((p1Lines[0]?.maturesAt ?? 0) - (Date.now() + 10 * DAY)) < 5000,
);
ok("die Zeile trägt die PaymentIntent-Id", p1Lines[0]?.id === "pi_1");

// Ein zweiter Kauf desselben Kunden zählt Umsatz, aber keinen zweiten Kunden.
await bookCommission(intentFor("pi_2", "kunde1@example.com", p1.code));
const afterSecond = await affiliateStore.getSummary(p1.email);
ok("ein zweiter Kauf desselben Kunden zählt beim Umsatz", afterSecond.revenueCents === 3790);
ok(
  "zählt aber nicht als zweiter geworbener Kunde",
  afterSecond.payingCustomers === 1,
  "die Leiter misst Menschen, nicht Käufe",
);

await bindCustomer("kunde2@example.com", p1);
await bookCommission(intentFor("pi_3", "kunde2@example.com", p1.code));
ok(
  "ein anderer Kunde zählt sehr wohl",
  (await affiliateStore.getSummary(p1.email)).payingCustomers === 2,
);

// ---------------------------------------------------------------------------
console.log("\n6 — Wer NICHT gebunden wird");

ok("Selbstwerbung wird abgelehnt", (await bindReferral(p1.email, p1.code)) === "self_referral");
ok(
  "und erzeugt auch im Webhook keine Provision",
  (await (async () => {
    await bookCommission(intentFor("pi_self", p1.email, p1.code));
    return (await affiliateStore.getCommission(p1.email, "pi_self")) === null;
  })()),
);

ok("ein unbekannter Code bindet niemanden", (await bindReferral("neu@example.com", "ZZZZZZ")) === "unknown_code");

const pending = await makePartner("wartend@example.com", "WARTEN", { status: "pending" });
ok(
  "ein noch nicht freigegebener Partner bindet niemanden",
  (await bindReferral("neu@example.com", pending.code)) === "inactive",
);
const blocked = await makePartner("gesperrt@example.com", "SPERRE", { status: "blocked" });
ok(
  "ein gesperrter Partner bindet niemanden",
  (await bindReferral("neu@example.com", blocked.code)) === "inactive",
);

ok("ein frischer Besucher wird gebunden", (await bindReferral("frisch@example.com", p1.code)) === "bound");
ok(
  "und die Anmeldung wird gezählt",
  (await affiliateStore.getSummary(p1.email)).signups === 1,
);

const p2 = await makePartner("partner2@example.com", "PARTNB");
ok(
  "eine bestehende Bindung wird nicht überschrieben",
  (await bindReferral("frisch@example.com", p2.code)) === "already_bound",
);
ok(
  "der ursprüngliche Partner behält den Kunden",
  (await affiliateStore.getBinding("frisch@example.com"))?.affiliateEmail === p1.email,
);

await entitlements.grant("bestand@example.com", {
  plan: "pro",
  paymentIntentId: "pi_alt",
  grantedAt: Date.now(),
});
ok(
  "ein Bestandskunde wird nicht nachträglich zugeordnet",
  (await bindReferral("bestand@example.com", p1.code)) === "existing_customer",
);
ok("und bekommt keine Bindung", (await affiliateStore.getBinding("bestand@example.com")) === null);

// Der Kaufpfad hängt seine Zuordnung nur an, wenn es etwas anzuhängen gibt.
ok(
  "ohne Bindung reist keine Zuordnung im Intent mit",
  Object.keys(await referralMetadataFor("niemand@example.com")).length === 0,
);
const meta = await referralMetadataFor("kunde1@example.com");
ok("mit Bindung reist der Code mit", meta.ref === p1.code);
ok("und der eingefrorene Satz", meta.refPercent === "10" && meta.refLevel === "1");

// ---------------------------------------------------------------------------
console.log("\n8 — Auszahlung: Mindestbetrag und offene Anträge");

const p3 = await makePartner("partner3@example.com", "PARTNC");
await bindCustomer("kunde3@example.com", p3);
await bookCommission(intentFor("pi_p3_a", "kunde3@example.com", p3.code));

/** Die Haltefrist vorspulen, statt zehn Tage zu warten. */
async function mature(affEmail: string) {
  for (const line of await affiliateStore.listCommissions(affEmail)) {
    if (line.status === "pending") {
      await affiliateStore.putCommission({ ...line, maturesAt: Date.now() - 1000 });
    }
  }
}
await mature(p3.email);

const tooSmall = await requestPayout(p3.email);
ok(
  "unter dem Mindestbetrag wird abgelehnt",
  !tooSmall.ok && tooSmall.error === "below_minimum",
  !tooSmall.ok ? tooSmall.error : "durchgelassen",
);
ok(
  "die Ablehnung nennt Betrag und Mindestbetrag",
  !tooSmall.ok && tooSmall.availableCents === 190 && tooSmall.minCents === 2500,
);

await affiliateStore.putAffiliate({ ...p3, payoutMinOverrideCents: 0 });
const allowed = await requestPayout(p3.email);
ok("mit Mindestbetrag 0 geht derselbe Antrag durch", allowed.ok, !allowed.ok ? allowed.error : "");
ok("der Antrag friert den Betrag ein", allowed.ok && allowed.payout.amountCents === 190);
ok(
  "und hält die Zahlungsdaten als Schnappschuss fest",
  allowed.ok && allowed.payout.snapshot.ibanLast4 === "3000",
);
ok(
  "die Provisionszeile ist jetzt beantragt",
  (await affiliateStore.listCommissions(p3.email))[0]?.status === "requested",
);

const second = await requestPayout(p3.email);
ok(
  "ein zweiter Antrag bei offenem Antrag wird abgelehnt",
  !second.ok && second.error === "open_payout" && second.status === 409,
);

const notActive = await makePartner("inaktiv@example.com", "INAKTV", { status: "blocked" });
ok(
  "ein gesperrter Partner kann nichts beantragen",
  (await (async () => {
    const res = await requestPayout(notActive.email);
    return !res.ok && res.error === "not_active";
  })()),
);

// Ablehnen gibt die Zeilen zurück in den auszahlbaren Topf.
const rejected = await decidePayout(
  allowed.ok ? allowed.payout.id : "",
  "reject",
  { reason: "Testablehnung" },
);
ok("ein Antrag lässt sich ablehnen", rejected.ok);
ok(
  "die Zeilen sind danach wieder frei",
  payableCents(await affiliateStore.listCommissions(p3.email), Date.now()) === 190,
);
const again = await requestPayout(p3.email);
ok("und der Partner darf erneut beantragen", again.ok);

// ---------------------------------------------------------------------------
console.log("\n9 — Storno nach der Auszahlung");

const paid = await decidePayout(again.ok ? again.payout.id : "", "paid", { reference: "SEPA-1" });
ok("der Antrag lässt sich als ausgezahlt markieren", paid.ok);
ok(
  "die Zeile steht auf bezahlt",
  (await affiliateStore.getCommission(p3.email, "pi_p3_a"))?.status === "paid",
);
ok("und der Auszahlungszähler stimmt", (await affiliateStore.getSummary(p3.email)).paidCents === 190);

// Ein zweiter, noch offener Verdienst, damit die Rückbuchung etwas mindern kann.
await bindCustomer("kunde4@example.com", p3);
await bookCommission(intentFor("pi_p3_b", "kunde4@example.com", p3.code, { refPercent: "30", refLevel: "5" }));
await mature(p3.email);
const beforeRefund = payableCents(await affiliateStore.listCommissions(p3.email), Date.now());
ok("vor dem Storno sind 569 Cent auszahlbar", beforeRefund === 569, `${beforeRefund}`);

await reverseCommission("pi_p3_a", "refund");
const lines3 = await affiliateStore.listCommissions(p3.email);
const original = lines3.find((c) => c.id === "pi_p3_a");
const compensation = lines3.find((c) => c.id === "rev_pi_p3_a");
ok("die bereits ausgezahlte Zeile bleibt unangetastet", original?.status === "paid");
ok("stattdessen entsteht ein Ausgleichsposten", Boolean(compensation));
ok("er trägt den negativen Betrag", compensation?.amountCents === -190);
ok("und ist sofort wirksam, nicht erst nach der Haltefrist", (compensation?.maturesAt ?? 0) <= Date.now());
const afterRefund = payableCents(lines3, Date.now());
ok("die nächste Auszahlung sinkt um den Betrag", afterRefund === 379, `${afterRefund}`);

// Eine noch nicht beantragte Provision wird dagegen direkt storniert.
const p4 = await makePartner("partner4@example.com", "PARTND");
await bindCustomer("kunde5@example.com", p4);
await bookCommission(intentFor("pi_p4_a", "kunde5@example.com", p4.code));
await reverseCommission("pi_p4_a", "refund");
const p4Line = await affiliateStore.getCommission(p4.email, "pi_p4_a");
const p4Sum = await affiliateStore.getSummary(p4.email);
ok("eine offene Provision wird direkt storniert", p4Line?.status === "reversed");
ok("ohne einen zweiten Posten", (await affiliateStore.listCommissions(p4.email)).length === 1);
ok("die Zähler werden zurückgedreht", p4Sum.earnedCents === 0 && p4Sum.revenueCents === 0);
ok("und der Kunde zählt nicht mehr als geworben", p4Sum.payingCustomers === 0);
ok(
  "ein doppeltes Storno bleibt folgenlos",
  (await (async () => {
    await reverseCommission("pi_p4_a", "refund");
    return (await affiliateStore.getSummary(p4.email)).earnedCents === 0;
  })()),
);

// Der Reparaturknopf des Admins baut die Zähler aus den Zeilen neu auf.
await affiliateStore.putSummary(p1.email, {
  clicks: 0, signups: 0, payingCustomers: 99, revenueCents: 1, earnedCents: 1, paidCents: 1, updatedAt: 0,
});
const rebuilt = await recomputeSummary(p1.email);
ok("Neu berechnen stellt die Wahrheit aus den Zeilen wieder her", rebuilt.payingCustomers === 2, `${rebuilt.payingCustomers}`);
ok("inklusive Umsatz", rebuilt.revenueCents === 5685, `${rebuilt.revenueCents}`);

// ---------------------------------------------------------------------------
console.log("\nTeilerstattung: nur der erstattete Anteil geht zurück");

const p6 = await makePartner("partner6@example.com", "PARTNF");
await bindCustomer("kunde7@example.com", p6);
await bookCommission(intentFor("pi_p6_a", "kunde7@example.com", p6.code, { refPercent: "20", refLevel: "3" }));
const p6Full = (await affiliateStore.listCommissions(p6.email))[0];
ok("die volle Provision beträgt 379 Cent", p6Full?.amountCents === 379, `${p6Full?.amountCents}`);

// 500 von 1895 Cent erstattet — knapp über ein Viertel.
await reverseCommission("pi_p6_a", "refund", { refundedCents: 500, chargedCents: 1895 });
const p6Lines = await affiliateStore.listCommissions(p6.email);
const p6Rev = p6Lines.find((c) => c.id === "rev_pi_p6_a");
ok("die Originalzeile bleibt unangetastet", p6Lines.find((c) => c.id === "pi_p6_a")?.status === "pending");
ok("es entsteht eine Ausgleichszeile", Boolean(p6Rev));
ok(
  "sie trägt nur den erstatteten Anteil",
  p6Rev?.amountCents === -100,
  `${p6Rev?.amountCents} statt -379 (500/1895 von 379 = 100)`,
);
ok("und wirkt sofort", (p6Rev?.maturesAt ?? 0) <= Date.now());
ok(
  "die Zähler wurden nur um diesen Anteil gemindert",
  (await affiliateStore.getSummary(p6.email)).earnedCents === 279,
  `${(await affiliateStore.getSummary(p6.email)).earnedCents}`,
);

// Zweite Teilerstattung: Stripe meldet kumulativ, also darf sich der Betrag
// nicht aufaddieren, sondern muss auf den neuen Gesamtstand nachziehen.
await reverseCommission("pi_p6_a", "refund", { refundedCents: 1000, chargedCents: 1895 });
const p6Rev2 = (await affiliateStore.listCommissions(p6.email)).find((c) => c.id === "rev_pi_p6_a");
ok(
  "eine zweite Teilerstattung zieht nach statt sich zu addieren",
  p6Rev2?.amountCents === -200,
  `${p6Rev2?.amountCents} (1000/1895 von 379 = 200, nicht -300)`,
);
ok(
  "die Zähler stimmen weiterhin",
  (await affiliateStore.getSummary(p6.email)).earnedCents === 179,
  `${(await affiliateStore.getSummary(p6.email)).earnedCents}`,
);
ok(
  "eine erneute Zustellung desselben Stands ändert nichts",
  (await (async () => {
    await reverseCommission("pi_p6_a", "refund", { refundedCents: 1000, chargedCents: 1895 });
    return (await affiliateStore.getSummary(p6.email)).earnedCents === 179;
  })()),
);
ok(
  "der Kunde zählt weiter als geworben — er hat ja gekauft",
  (await affiliateStore.getSummary(p6.email)).payingCustomers === 1,
);

// Eine Erstattung über den vollen Betrag ist weiterhin ein ganzes Storno.
await reverseCommission("pi_p6_a", "refund", { refundedCents: 1895, chargedCents: 1895 });
ok(
  "die volle Erstattung storniert die Zeile",
  (await affiliateStore.getCommission(p6.email, "pi_p6_a"))?.status === "reversed",
);

// ---------------------------------------------------------------------------
console.log("\nNach einem Storno darf derselbe Kunde wieder zählen");

const p7 = await makePartner("partner7@example.com", "PARTNG");
await bindCustomer("kunde8@example.com", p7);
await bookCommission(intentFor("pi_p7_a", "kunde8@example.com", p7.code));
ok(
  "nach dem Kauf ist der Erstkauf vermerkt",
  (await affiliateStore.getBinding("kunde8@example.com"))?.firstPurchaseAt !== null,
);
await reverseCommission("pi_p7_a", "refund", { refundedCents: 1895, chargedCents: 1895 });
ok(
  "das Storno setzt den Erstkauf zurück",
  (await affiliateStore.getBinding("kunde8@example.com"))?.firstPurchaseAt === null,
  "sonst zählt der Kunde nie wieder und bekommt unter „nur Erstkauf“ nie wieder eine Provision",
);
await bookCommission(intentFor("pi_p7_b", "kunde8@example.com", p7.code));
ok(
  "ein neuer Kauf desselben Kunden zählt wieder",
  (await affiliateStore.getSummary(p7.email)).payingCustomers === 1,
  `${(await affiliateStore.getSummary(p7.email)).payingCustomers}`,
);

// ---------------------------------------------------------------------------
console.log("\nVerkauf in Fremdwährung");

const p8 = await makePartner("partner8@example.com", "PARTNH");
await bindCustomer("kunde9@example.com", p8);
await bookCommission({
  ...intentFor("pi_p8_usd", "kunde9@example.com", p8.code),
  currency: "usd",
  amount: CURRENT_BLUEPRINT_CENTS,
  metadata: {
    ...intentFor("pi_p8_usd", "kunde9@example.com", p8.code).metadata,
    grossMinor: String(CURRENT_BLUEPRINT_CENTS),
  },
});
ok(
  "ein USD-Verkauf zum selben Preis wird gebucht",
  (await affiliateStore.listCommissions(p8.email)).length === 1,
  "die englische Storefront verkauft denselben Zahlenwert in USD wie in EUR",
);
ok(
  "und zwar mit demselben Betrag",
  (await affiliateStore.listCommissions(p8.email))[0]?.amountCents ===
    Math.round(CURRENT_BLUEPRINT_CENTS * 0.1),
);

// Sobald der Preis wirklich umgerechnet würde, greift die Bremse wieder.
await bookCommission({
  ...intentFor("pi_p8_fx", "kunde9@example.com", p8.code),
  currency: "usd",
  amount: 2295,
});
ok(
  "ein umgerechneter Fremdwährungspreis wird NICHT gebucht",
  (await affiliateStore.getCommission(p8.email, "pi_p8_fx")) === null,
  "sonst zahlte man 20 % auf einen Betrag, den man nie in Euro eingenommen hat",
);

// ---------------------------------------------------------------------------
console.log("\nGleichzeitige Auszahlungsanträge");

const p5 = await makePartner("partner5@example.com", "PARTNE", { payoutMinOverrideCents: 0 });
await bindCustomer("kunde6@example.com", p5);
await bookCommission(intentFor("pi_p5_a", "kunde6@example.com", p5.code));
await mature(p5.email);

// Zwei Anträge im selben Tick: genau der Doppelklick, den die Prüfung
// "kein offener Antrag" allein nicht abfängt, weil sie ein Lesen ist.
const raced = await Promise.all([requestPayout(p5.email), requestPayout(p5.email)]);
const survivors = raced.filter((r) => r.ok);
ok(
  "von zwei gleichzeitigen Anträgen überlebt genau einer",
  survivors.length === 1,
  `${survivors.length} von 2`,
);
const stillOpen = (await affiliateStore.listPayoutsFor(p5.email)).filter(
  (p) => p.status === "requested" || p.status === "approved",
);
ok("und im Speicher steht genau ein offener Antrag", stillOpen.length === 1, `${stillOpen.length}`);
ok(
  "die Provision hängt an genau einem Antrag",
  (await affiliateStore.listCommissions(p5.email)).filter((c) => c.payoutId !== null).length === 1,
);

// ---------------------------------------------------------------------------
console.log("\n12 — Das Ref-Cookie ist signiert");

const signed = signRef("PARTNA", 60);
ok("ein signiertes Cookie liest sich zurück", readRef(signed) === "PARTNA");
ok("undefined ergibt null", readRef(undefined) === null);
ok("Müll ergibt null", readRef("nur-irgendwas") === null);

const [payload, sig] = signed.split(".");
ok("eine veränderte Signatur wird verworfen", readRef(`${payload}.${sig.slice(0, -2)}xx`) === null);
const foreignPayload = Buffer.from(JSON.stringify({ code: "PARTNB", exp: Date.now() + DAY })).toString(
  "base64url",
);
ok(
  "ein untergeschobener fremder Code wird verworfen",
  readRef(`${foreignPayload}.${sig}`) === null,
  "sonst wäre das Cookie eine Selbstbedienungs-Provision",
);

const savedSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "ein-vollkommen-anderes-geheimnis";
ok("mit fremdem Schlüssel signiert gilt es nicht", readRef(signed) === null);
process.env.AUTH_SECRET = savedSecret;
ok("mit dem richtigen Schlüssel wieder schon", readRef(signed) === "PARTNA");

console.info = realInfo;
console.warn = realWarn;

console.log(
  failed === 0
    ? `\nALLE TESTS BESTANDEN — ${checks}/${checks} Prüfungen ok`
    : `\n${failed} von ${checks} Prüfungen FEHLGESCHLAGEN`,
);
process.exit(failed === 0 ? 0 : 1);
