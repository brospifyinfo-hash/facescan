// Referral codes and invite codes.
//
// THE ALPHABET LEAVES OUT I, O, 0 AND 1. These codes get read off a phone
// screen, dictated over the phone and typed by hand — every pair that looks
// alike in a sans-serif font is a support ticket. 32 characters also keeps the
// entropy easy to reason about: 6 characters are 32^6 ≈ 1.07 billion
// possibilities, 8 characters are 32^8 ≈ 1.1 trillion.
//
// crypto.randomInt, NOT Math.random. A referral code is a bearer token for
// somebody else's commission and an invite code is an entry permit; both would
// be guessable from a seeded PRNG, and Math.random is seeded by the runtime.

import { randomInt } from "crypto";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const ALLOWED = new Set(CODE_ALPHABET.split(""));

/** Cryptographically random, uniformly distributed over the alphabet. */
export function randomCode(len: number): string {
  const size = Math.max(1, Math.floor(len));
  let out = "";
  for (let i = 0; i < size; i += 1) {
    // randomInt is rejection-sampled internally, so no modulo bias.
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * What a human typed → what the index is keyed by.
 *
 * Upper-cased, then everything outside the alphabet is dropped: people paste
 * "?ref=ABC-123", add a trailing space, or wrap the code in quotes, and the
 * friendly reading of that is the code they meant.
 *
 * NO LOOK-ALIKE FOLDING. It is tempting to map a typed "O" onto "Q" or an "I"
 * onto "J", but the alphabet contains real Q, J and L: a fold would silently
 * rewrite valid codes into different valid codes, and a partner would lose
 * commissions to a stranger. I/O/0/1 never occur in a generated code, so when
 * one shows up the input is already wrong — dropping it fails the lookup,
 * which is the honest outcome.
 *
 * Idempotent: normalizeCode(normalizeCode(x)) === normalizeCode(x).
 */
export function normalizeCode(raw: string): string {
  const upper = (raw ?? "").toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (ALLOWED.has(ch)) out += ch;
  }
  return out;
}
