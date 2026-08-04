// One-time-password storage.
//
// ⚠️ PROTOTYPE BACKING: a module-level Map. That is fine for local work and
// a single long-lived server, and WRONG for serverless production — every
// cold start wipes it, and two concurrent instances do not share it, so a
// user can receive a code from instance A and have it rejected by instance B.
//
// The whole surface is the `OtpStore` interface below. Swapping in Redis
// (Upstash, Vercel KV) means writing one more implementation of it and
// changing the export at the bottom. Nothing else in the app touches this.

import { createHash, randomInt, timingSafeEqual } from "crypto";

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
declare global {
  // eslint-disable-next-line no-var
  var __facescanOtpStore: OtpStore | undefined;
}

export const otpStore: OtpStore =
  globalThis.__facescanOtpStore ?? (globalThis.__facescanOtpStore = new MemoryOtpStore());

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
