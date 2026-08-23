// IBAN handling: normalise, check, mask.
//
// WHY A CHECKSUM CHECK AND NOT A REGEX
// A typo in an IBAN is not a form error, it is a transfer to somebody else or
// a failed payout that comes back days later with a fee attached. The mod-97
// check (ISO 7064) catches every single-character mistake and virtually every
// transposition — for the cost of thirty lines. A length-and-shape regex
// catches neither.
//
// WHY THE MODULO IS COMPUTED IN CHUNKS
// A rearranged IBAN is a 20–36 digit number. Number cannot hold it (2^53),
// BigInt could — but BigInt is not available on every runtime this file might
// be pulled into, and the chunked remainder is the standard formulation
// anyway: take nine digits, then keep prepending the remainder to the next
// seven.

/** Expected total length per country. Source: the SWIFT IBAN registry. */
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29,
  BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, EG: 29,
  ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22,
  MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15, PK: 24, PL: 28, PS: 29, PT: 25,
  QA: 29, RO: 24, RS: 22, SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25,
  SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

/** Upper case, no spaces, no dashes — the form people actually type. */
export function normalizeIban(raw: string): string {
  return (raw ?? "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export function ibanCountry(raw: string): string {
  return normalizeIban(raw).slice(0, 2);
}

/**
 * Structure, length and ISO 7064 mod-97 checksum.
 *
 * An unknown country prefix is not rejected outright — the registry grows, and
 * refusing a valid Turkish IBAN because this table is a year old would be our
 * bug, not the partner's. It still has to pass the checksum and a plausible
 * length, which is what actually protects the transfer.
 */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;

  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined) {
    if (iban.length !== expected) return false;
  } else if (iban.length < 15 || iban.length > 34) {
    return false;
  }

  return mod97(iban) === 1;
}

/** Move the first four characters to the end, letters become numbers, mod 97. */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let digits = "";
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    // 'A'..'Z' → 10..35, digits stay as they are.
    digits += code >= 65 && code <= 90 ? String(code - 55) : ch;
  }

  let remainder = 0;
  for (let i = 0; i < digits.length; i += 7) {
    const block = String(remainder) + digits.slice(i, i + 7);
    remainder = Number(block) % 97;
  }
  return remainder;
}

/** The last four digits — the only part that may reach a client. */
export function ibanLast4(raw: string): string {
  return normalizeIban(raw).slice(-4);
}

/**
 * "DE89 3704 0044 0532 0130 00" → "DE•• •••• 3000".
 *
 * Enough for the partner to recognise their own account, useless to anybody
 * who intercepts it.
 */
export function maskIban(raw: string): string {
  const iban = normalizeIban(raw);
  if (iban.length < 6) return "••••";
  return `${iban.slice(0, 2)}•• •••• ${iban.slice(-4)}`;
}

/** Groups of four, the way a bank prints it — for the admin's payout screen. */
export function formatIban(raw: string): string {
  return normalizeIban(raw).replace(/(.{4})/g, "$1 ").trim();
}
