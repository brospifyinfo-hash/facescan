// One-time-password storage.
//
// TWO BACKINGS, CHOSEN BY THE ENVIRONMENT
//
//   RedisOtpStore   used whenever Upstash credentials are present. This is
//                   the one production needs.
//   MemoryOtpStore  a module-level Map. Correct for local development and
//                   for tests; WRONG for serverless, because every cold
//                   start wipes it and two concurrent instances do not
//                   share it — so a user receives a code from instance A
//                   and has it rejected by instance B. The failure looks
//                   random, which is what makes it expensive: it does not
//                   reproduce for whoever is testing and it does reproduce
//                   for a share of real users.
//
// The whole surface is the `OtpStore` interface, exactly as designed for.
// Nothing else in the app changed to add the Redis one.

import { createHash, randomInt, timingSafeEqual } from "crypto";
import { kv, kvConfigured, kvPipeline, toHash } from "../kv";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
/** Per-address throttle so the endpoint can't be used to spam inboxes. */
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_SENDS_PER_WINDOW = 5;
export const SEND_WINDOW_MS = 15 * 60 * 1000;

export interface OtpRecord {
  /** Only the hash is kept — a leaked store should not hand out live codes. */
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

export interface SendLog {
  timestamps: number[];
}

export interface OtpStore {
  put(email: string, rec: OtpRecord): Promise<void>;
  get(email: string): Promise<OtpRecord | null>;
  delete(email: string): Promise<void>;
  bumpAttempts(email: string): Promise<number>;
  recordSend(email: string): Promise<void>;
  sendsInWindow(email: string): Promise<number[]>;
}

class MemoryOtpStore implements OtpStore {
  private codes = new Map<string, OtpRecord>();
  private sends = new Map<string, SendLog>();

  async put(email: string, rec: OtpRecord) {
    this.codes.set(email, rec);
  }
  async get(email: string) {
    const rec = this.codes.get(email);
    if (!rec) return null;
    if (Date.now() > rec.expiresAt) {
      this.codes.delete(email);
      return null;
    }
    return rec;
  }
  async delete(email: string) {
    this.codes.delete(email);
  }
  async bumpAttempts(email: string) {
    const rec = this.codes.get(email);
    if (!rec) return MAX_ATTEMPTS;
    rec.attempts += 1;
    if (rec.attempts >= MAX_ATTEMPTS) this.codes.delete(email);
    return rec.attempts;
  }
  async recordSend(email: string) {
    const log = this.sends.get(email) ?? { timestamps: [] };
    log.timestamps.push(Date.now());
    this.sends.set(email, log);
  }
  async sendsInWindow(email: string) {
    const cutoff = Date.now() - SEND_WINDOW_MS;
    const log = this.sends.get(email);
    if (!log) return [];
    log.timestamps = log.timestamps.filter((t) => t > cutoff);
    return log.timestamps;
  }
}

// Pinned to globalThis, not a plain module constant.
//
// Next.js loads route handlers in separate module graphs, so a module-level
// `new MemoryOtpStore()` gives request-code and verify-code a Map each: the
// code is written to one and looked up in the other, and every verification
// fails with "expired". Hot reloads would wipe it too. globalThis is the one
// thing both share.
/**
 * Redis-backed store. Survives cold starts and is shared across instances,
 * which is the whole point.
 *
 * KEY LAYOUT
 *   otp:<email>      hash {codeHash, expiresAt, attempts}, TTL = CODE_TTL_MS
 *   otpsend:<email>  JSON array of send timestamps, TTL = SEND_WINDOW_MS
 *
 * Redis expiry does the cleanup, so nothing accumulates and no sweeper is
 * needed. The in-code expiry check stays anyway: TTL eviction is not
 * instant, and a code that Redis has not got round to deleting must still
 * be treated as dead.
 */
class RedisOtpStore implements OtpStore {
  private codeKey = (email: string) => `otp:${email}`;
  private sendKey = (email: string) => `otpsend:${email}`;

  async put(email: string, rec: OtpRecord) {
    const key = this.codeKey(email);
    await kvPipeline(
      ["DEL", key],
      ["HSET", key, "codeHash", rec.codeHash, "expiresAt", String(rec.expiresAt), "attempts", String(rec.attempts)],
      // A little past the logical TTL: expiry is enforced in code, and a key
      // that vanishes a second early would turn a valid code into "expired".
      ["PEXPIRE", key, String(CODE_TTL_MS + 60_000)],
    );
  }

  async get(email: string) {
    const hash = toHash(await kv("HGETALL", this.codeKey(email)));
    if (!hash?.codeHash) return null;
    const rec: OtpRecord = {
      codeHash: hash.codeHash,
      expiresAt: Number(hash.expiresAt),
      attempts: Number(hash.attempts) || 0,
    };
    if (!Number.isFinite(rec.expiresAt) || Date.now() > rec.expiresAt) {
      await this.delete(email);
      return null;
    }
    return rec;
  }

  async delete(email: string) {
    await kv("DEL", this.codeKey(email));
  }

  /**
   * HINCRBY rather than read-modify-write.
   *
   * The memory implementation reads, adds one and writes back. Over a
   * shared store that races: two parallel guesses both read 4, both write
   * 5, and the fifth attempt never trips the limit. HINCRBY is atomic
   * server-side, so the count is exact no matter how many instances are
   * guessing at once — which is the entire value of a brute-force limit.
   */
  async bumpAttempts(email: string) {
    const key = this.codeKey(email);
    const exists = await kv("EXISTS", key);
    if (!exists) return MAX_ATTEMPTS;
    const attempts = Number(await kv("HINCRBY", key, "attempts", 1));
    if (attempts >= MAX_ATTEMPTS) await kv("DEL", key);
    return attempts;
  }

  async recordSend(email: string) {
    const key = this.sendKey(email);
    const timestamps = await this.sendsInWindow(email);
    timestamps.push(Date.now());
    await kv("SET", key, JSON.stringify(timestamps), "PX", String(SEND_WINDOW_MS));
  }

  async sendsInWindow(email: string) {
    const raw = await kv("GET", this.sendKey(email));
    if (typeof raw !== "string") return [];
    try {
      const cutoff = Date.now() - SEND_WINDOW_MS;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((t: unknown) => typeof t === "number" && t > cutoff)
        : [];
    } catch {
      // A corrupt value is a throttle counter, not an account. Treating it
      // as empty costs at most a few extra sends; throwing would lock the
      // user out of signing in entirely.
      return [];
    }
  }
}

// Pinned to globalThis, not a plain module constant.
//
// Next.js loads route handlers in separate module graphs, so a module-level
// `new MemoryOtpStore()` gives request-code and verify-code a Map each: the
// code is written to one and looked up in the other, and every verification
// fails with "expired". Hot reloads would wipe it too. globalThis is the one
// thing both share. (Irrelevant for the Redis store, which shares by
// definition — but the selection still happens once.)
declare global {
  // eslint-disable-next-line no-var
  var __facescanOtpStore: OtpStore | undefined;
}

export const otpStore: OtpStore =
  globalThis.__facescanOtpStore ??
  (globalThis.__facescanOtpStore = kvConfigured()
    ? new RedisOtpStore()
    : new MemoryOtpStore());

/** Which backing is live. Surfaced by the health check, never to a user. */
export const otpBacking = (): "redis" | "memory" =>
  kvConfigured() ? "redis" : "memory";

/** Normalise so "A@B.com " and "a@b.com" are the same account. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Cryptographically random 6-digit code, zero-padded. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison — a fast reject leaks the code digit by digit. */
export function codeMatches(input: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(input), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
