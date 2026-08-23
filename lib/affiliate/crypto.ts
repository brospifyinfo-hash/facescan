// Encryption for the one piece of data in this product that is worth stealing:
// the partners' bank details.
//
// WHY AT ALL, WHEN THE STORE IS "OURS"
// The store behind this app is a Google spreadsheet (lib/sheets-kv.ts). A
// plain-text IBAN in there is one compromised Google login away from being a
// list of names, addresses and account numbers. Encrypting it means the
// spreadsheet alone is worthless: the key lives in the deployment environment,
// not in the document.
//
// AES-256-GCM, not CBC or CTR: it authenticates as well as encrypts, so a
// tampered ciphertext fails loudly instead of decrypting to garbage that some
// later code path might treat as an account number.
//
// A FRESH IV PER RECORD. GCM catastrophically breaks if an IV repeats under
// the same key — it is not "slightly weaker", it leaks the plaintext XOR. The
// 12 random bytes are stored alongside the ciphertext, which is normal and safe.
//
// FAILS CLOSED. No key means encryptSecret throws, which means the application
// form refuses with a clear message. Storing an IBAN in the clear "just for
// now" is exactly how it ends up in a spreadsheet forever.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * NO NEW ENVIRONMENT VARIABLE IS REQUIRED.
 *
 * The key is derived from AUTH_SECRET, which this deployment already has (it
 * signs the session and admin cookies). One secret fewer to set is one secret
 * fewer to forget, and a partner programme that refuses every application
 * because nobody set a variable is a worse outcome than the one this file is
 * defending against.
 *
 * HKDF, not "use AUTH_SECRET as the key": a key derivation function separates
 * the cipher key from the signing secret, so the IBAN key cannot be recovered
 * from a leaked HMAC and vice versa. The info label is what makes them
 * different keys from the same root.
 *
 * AFFILIATE_PII_KEY still wins when it is set, for the deployment that wants
 * bank details on a key of their own — one that can be rotated without
 * invalidating every session, or held somewhere AUTH_SECRET is not.
 */
function explicitKey(): Buffer | null {
  const raw = process.env.AFFILIATE_PII_KEY;
  if (!raw) return null;
  let key: Buffer;
  try {
    key = Buffer.from(raw.trim(), "base64");
  } catch {
    return null;
  }
  // A short key is a configuration mistake, and padding it out silently would
  // produce a cipher that looks fine and is not.
  return key.length === KEY_BYTES ? key : null;
}

function derivedKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  return Buffer.from(
    hkdfSync("sha256", secret, "facescan-affiliate-pii", "iban-v1", KEY_BYTES),
  );
}

/**
 * Every key a stored value might have been written under, best first.
 *
 * Two entries rather than one so that ADDING AFFILIATE_PII_KEY later does not
 * brick the IBANs that were stored under the derived key: new writes use the
 * explicit key, old values still decrypt. Removing it again works the same way
 * in reverse.
 */
function keys(): Buffer[] {
  return [explicitKey(), derivedKey()].filter((k): k is Buffer => k !== null);
}

/** True when an IBAN can be stored safely. Checked before any form is accepted. */
export function piiKeyConfigured(): boolean {
  return keys().length > 0;
}

export class PiiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PiiKeyError";
  }
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function encryptSecret(plain: string): string {
  const key = keys()[0];
  if (!key) {
    throw new PiiKeyError("No PII key: AUTH_SECRET is missing or too short, and AFFILIATE_PII_KEY is unset.");
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Throws on a missing key, an unknown format, or a tampered payload.
 *
 * Callers must not swallow that into an empty string: "no IBAN" and "somebody
 * edited the ciphertext" are very different situations, and only one of them
 * is safe to pay out against.
 */
export function decryptSecret(token: string): string {
  const candidates = keys();
  if (candidates.length === 0) {
    throw new PiiKeyError("No PII key: AUTH_SECRET is missing or too short, and AFFILIATE_PII_KEY is unset.");
  }
  const parts = (token ?? "").split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new PiiKeyError("Encrypted value has an unexpected format.");
  }
  const [, ivPart, tagPart, ctPart] = parts;
  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ctPart, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new PiiKeyError("Encrypted value has an unexpected format.");
  }

  // Every configured key is tried, so a value written before AFFILIATE_PII_KEY
  // existed still opens after it is added. GCM makes this safe to attempt:
  // a wrong key fails the authentication tag, it does not return plausible
  // garbage the caller might pay out against.
  for (const key of candidates) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      // final() is where a wrong key or a tampered ciphertext throws — that is
      // the whole point of GCM.
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      /* try the next key */
    }
  }
  throw new PiiKeyError("Encrypted value could not be decrypted with any configured key.");
}
