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

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function readKey(): Buffer | null {
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

/** True when an IBAN can be stored safely. Checked before any form is accepted. */
export function piiKeyConfigured(): boolean {
  return readKey() !== null;
}

export class PiiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PiiKeyError";
  }
}

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function encryptSecret(plain: string): string {
  const key = readKey();
  if (!key) {
    throw new PiiKeyError("AFFILIATE_PII_KEY is missing or not 32 bytes of base64.");
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
  const key = readKey();
  if (!key) {
    throw new PiiKeyError("AFFILIATE_PII_KEY is missing or not 32 bytes of base64.");
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

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  // final() is where a tampered ciphertext throws — that is the whole point of GCM.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
