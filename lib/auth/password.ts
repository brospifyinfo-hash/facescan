// Account passwords, opt-in on top of the OTP.
//
// THE OTP STAYS THE ROOT OF THE ACCOUNT. An address only ever gets a
// password AFTER proving the inbox once (the set endpoint requires a live
// session), so a password here is a convenience credential for re-entry,
// not a way to claim an unverified address. Losing it costs nothing — the
// email code always works and quietly doubles as the reset path.
//
// SCRYPT, VIA NODE'S OWN CRYPTO. No dependency: scrypt is memory-hard
// (bcrypt is not), ships in node:crypto, and the parameters are stored next
// to the hash so they can be raised later without invalidating anyone.
//
// STORAGE is the same sheets-kv the OTP store uses, key `pwd:<email>`,
// no TTL — a password does not expire. The brute-force limit rides on
// `pwdtry:<email>` with a short TTL, counted atomically by the script lock
// (skBump), exactly like the OTP attempt counter.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { skDel, skGetJson, skSetJson, skBump, sheetsKvConfigured } from "../sheets-kv";

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
export const MAX_TRIES = 8;
const TRY_WINDOW_MS = 15 * 60 * 1000;
const KEY_LEN = 64;

/** Stored parameters ride with the hash so they can be raised later. */
interface PasswordRecord {
  saltHex: string;
  hashHex: string;
  /** scrypt cost (N). */
  n: number;
  at: number;
}

const pwdKey = (email: string) => `pwd:${email}`;
const tryKey = (email: string) => `pwdtry:${email}`;

/** Local fallback so a checkout with no credentials still runs. */
const memory = new Map<string, PasswordRecord>();
const memoryTries = new Map<string, { n: number; resetAt: number }>();

export function passwordValid(password: unknown): password is string {
  return (
    typeof password === "string" &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH
  );
}

function derive(password: string, saltHex: string, n: number): Promise<Buffer> {
  // Hand-promisified: util.promisify loses the options overload in the
  // type definitions. maxmem must clear 128 * N * r (r=8); give it headroom.
  return new Promise((resolve, reject) => {
    scryptCb(
      password,
      Buffer.from(saltHex, "hex"),
      KEY_LEN,
      { N: n, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function setPassword(email: string, password: string): Promise<void> {
  const saltHex = randomBytes(16).toString("hex");
  const n = 16384;
  const hash = await derive(password, saltHex, n);
  const rec: PasswordRecord = { saltHex, hashHex: hash.toString("hex"), n, at: Date.now() };
  if (sheetsKvConfigured()) {
    try {
      await skSetJson(pwdKey(email), rec);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memory.set(email, rec);
}

export async function clearPassword(email: string): Promise<void> {
  memory.delete(email);
  if (sheetsKvConfigured()) {
    try {
      await skDel(pwdKey(email));
    } catch {
      /* the memory floor is already cleared */
    }
  }
}

async function getRecord(email: string): Promise<PasswordRecord | null> {
  if (sheetsKvConfigured()) {
    try {
      const rec = await skGetJson<PasswordRecord>(pwdKey(email));
      if (rec?.hashHex && rec.saltHex && Number.isFinite(rec.n)) return rec;
      return null;
    } catch {
      /* fall through */
    }
  }
  return memory.get(email) ?? null;
}

export async function hasPassword(email: string): Promise<boolean> {
  return (await getRecord(email)) !== null;
}

/**
 * The brute-force gate. Counted BEFORE the hash comparison, so a flood of
 * guesses burns its allowance whether or not any of them are close.
 * Returns the tries used, or null when the store cannot say — in which
 * case the caller fails CLOSED for this window: a password login the
 * limiter cannot see is the one kind that must not proceed.
 */
async function bumpTries(email: string): Promise<number | null> {
  if (sheetsKvConfigured()) {
    try {
      const n = await skBump(tryKey(email), "n", 1);
      if (typeof n === "number") return n;
      await skSetJson(tryKey(email), { n: 1 }, TRY_WINDOW_MS);
      return 1;
    } catch {
      return null;
    }
  }
  const now = Date.now();
  const cur = memoryTries.get(email);
  if (!cur || now > cur.resetAt) {
    memoryTries.set(email, { n: 1, resetAt: now + TRY_WINDOW_MS });
    return 1;
  }
  cur.n += 1;
  return cur.n;
}

export type PasswordCheck = "ok" | "wrong" | "none" | "locked" | "unavailable";

export async function checkPassword(email: string, password: string): Promise<PasswordCheck> {
  const tries = await bumpTries(email);
  if (tries === null) return "unavailable";
  if (tries > MAX_TRIES) return "locked";

  const rec = await getRecord(email);
  // Burn real time even when no record exists, so "this address has no
  // password" is not measurable from the response latency.
  if (!rec) {
    await derive(password, "00".repeat(16), 16384);
    return "none";
  }

  const hash = await derive(password, rec.saltHex, rec.n);
  const stored = Buffer.from(rec.hashHex, "hex");
  if (hash.length !== stored.length || !timingSafeEqual(hash, stored)) return "wrong";
  return "ok";
}
