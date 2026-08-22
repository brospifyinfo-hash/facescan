// A short-lived permit to SET A PASSWORD — and nothing else.
//
// WHY THIS EXISTS. The email code used to hand out a session directly, so
// possession of an inbox was a login. That is no longer the product rule:
// signing in requires the password, and the code's only job is to prove the
// inbox once — at registration, and again when a password is forgotten.
//
// So verifying a code mints THIS instead of a session: an HMAC-signed
// ticket, same scheme as the session cookie, that authorises exactly one
// thing (POST /api/auth/password without a session) and expires in fifteen
// minutes. Stealing it buys the thief the ability to set a password on an
// address whose inbox they already proved they control — which is nothing
// they could not do by asking for another code.
//
// SINGLE USE IN PRACTICE: the OTP is deleted the moment it verifies, so a
// ticket can only be obtained once per code, and the cookie is cleared as
// soon as the password is written.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const TICKET_COOKIE = "facescan_pwticket";
export const TICKET_TTL_MS = 15 * 60 * 1000;

const DEV_SECRET = "facescan-dev-only-not-for-production";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is missing or too short. Set a random 32+ character value.");
  }
  return DEV_SECRET;
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const sign = (payload: string) => b64url(createHmac("sha256", secret()).update(payload).digest());

interface Ticket {
  email: string;
  /** Pinned, so a ticket can never be replayed as some other credential. */
  purpose: "pwset";
  exp: number;
}

function createTicket(email: string): string {
  const payload = b64url(
    Buffer.from(JSON.stringify({ email, purpose: "pwset", exp: Date.now() + TICKET_TTL_MS })),
  );
  return `${payload}.${sign(payload)}`;
}

function readTicket(token: string | undefined): Ticket | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Ticket;
    if (!data.email || data.purpose !== "pwset") return null;
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setTicketCookie(email: string): Promise<void> {
  const jar = await cookies();
  jar.set(TICKET_COOKIE, createTicket(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TICKET_TTL_MS / 1000),
  });
}

export async function clearTicketCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(TICKET_COOKIE);
}

/** The address a live ticket authorises, or null. */
export async function currentTicket(): Promise<string | null> {
  const jar = await cookies();
  return readTicket(jar.get(TICKET_COOKIE)?.value)?.email ?? null;
}
