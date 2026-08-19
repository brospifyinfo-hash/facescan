// Session cookie: a stateless, HMAC-signed token.
//
// No database is involved — the cookie carries the address and an expiry,
// and the signature is what makes it unforgeable. That is enough for an
// account whose only purpose is "this inbox proved it owns this address".
// The moment sessions need to be revocable server-side, this becomes a
// lookup against a real session table.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "facescan_session";
/**
 * A year, minus nothing. "Stay signed in" is the product decision: the
 * account exists to hold scan history, and being thrown out of it monthly
 * cost more support than it bought security. Chrome caps cookie lifetimes
 * at 400 days anyway; on top of the long TTL the session route RENEWS the
 * cookie on every check, so anyone who visits even occasionally never
 * reaches the edge of it.
 */
export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const DEV_SECRET = "facescan-dev-only-not-for-production";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    // Refuse to mint forgeable sessions in production.
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a random 32+ character value.",
    );
  }
  return DEV_SECRET;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

export interface Session {
  email: string;
  exp: number;
}

export function createToken(email: string): string {
  const payload = b64url(
    Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS })),
  );
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Session;
    if (!data.email || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setSessionCookie(email: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  return readToken(jar.get(SESSION_COOKIE)?.value);
}
