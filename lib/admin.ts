// Admin access: one code, checked on the server.
//
// NOT the email login. The catalogue editor is an owner tool, and requiring
// an inbox round trip to reach it is friction for the only person who uses
// it — worse, it makes the editor depend on the OTP store working, which is
// a separate moving part with its own failure mode.
//
// NOT the code in components/ui/DevUnlock.tsx either. That one is compared in
// the browser, so it is in the shipped bundle and anyone who opens devtools
// has it. Fine for revealing a preview; useless for something that writes to
// a live catalogue.
//
// So: the code lives in ADMIN_CODE, server-side only, never sent to a client.
// Submitting it mints a short-lived HMAC-signed cookie — the same scheme the
// session cookie uses, so there is one signing story in the codebase rather
// than two.
//
// FAILS CLOSED. No ADMIN_CODE means nobody is an admin, in any environment.
// The code is deliberately NOT defaulted in source: this repository is
// published, and a default would be the credential.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "facescan_admin";
/** Twelve hours. Long enough for an editing session, short enough that a
 *  forgotten browser on a shared machine is not a standing door. */
export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is missing or too short.");
  }
  return "facescan-dev-only-not-for-production";
}

const b64url = (buf: Buffer) => buf.toString("base64url");
const sign = (payload: string) =>
  b64url(createHmac("sha256", secret()).update(payload).digest());

/** Constant-time compare, so a wrong code cannot be narrowed by timing. */
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export const adminConfigured = (): boolean =>
  typeof process.env.ADMIN_CODE === "string" && process.env.ADMIN_CODE.length > 0;

/** True when `code` is the configured admin code. */
export function checkAdminCode(code: string): boolean {
  const expected = process.env.ADMIN_CODE;
  if (!expected) return false;
  return sameSecret(code, expected);
}

function createAdminToken(): string {
  const payload = b64url(
    Buffer.from(JSON.stringify({ admin: true, exp: Date.now() + ADMIN_TTL_MS })),
  );
  return `${payload}.${sign(payload)}`;
}

function readAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length) return false;
  if (!timingSafeEqual(expected, given)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      admin?: boolean;
      exp?: number;
    };
    return data.admin === true && typeof data.exp === "number" && Date.now() < data.exp;
  } catch {
    return false;
  }
}

export async function setAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, createAdminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ADMIN_TTL_MS / 1000),
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

/** Is this request from the admin? The only question the routes ask. */
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return readAdminToken(jar.get(ADMIN_COOKIE)?.value);
}
