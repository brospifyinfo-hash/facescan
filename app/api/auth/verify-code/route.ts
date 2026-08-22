import { NextResponse } from "next/server";
import { setTicketCookie } from "@/lib/auth/ticket";
import { hasPassword } from "@/lib/auth/password";
import {
  codeMatches,
  isEmail,
  MAX_ATTEMPTS,
  normalizeEmail,
  otpStore,
} from "@/lib/auth/store";

export const runtime = "nodejs";

/**
 * Exchange a valid code for a PASSWORD-SET TICKET — not for a session.
 *
 * The code proves the inbox; signing in is the password's job. So this
 * hands out the short-lived permit described in lib/auth/ticket.ts, and
 * the session is minted only once a password exists. That is what makes
 * "the email code is no longer a way in" true rather than merely intended.
 *
 * `existing` tells the client whether this address already had a password,
 * so the next screen can say "choose a new one" instead of "welcome". It
 * leaks nothing: the caller has just proved they own the inbox.
 */
export async function POST(req: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const code = (body.code ?? "").replace(/\D/g, "");

  if (!isEmail(email) || code.length !== 6) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const rec = await otpStore.get(email);
  if (!rec) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }

  if (!codeMatches(code, rec.codeHash)) {
    const attempts = await otpStore.bumpAttempts(email);
    const left = Math.max(0, MAX_ATTEMPTS - attempts);
    return NextResponse.json(
      { error: left === 0 ? "locked" : "wrong_code", attemptsLeft: left },
      { status: 400 },
    );
  }

  // Single use — burn it before handing out the ticket.
  await otpStore.delete(email);
  await setTicketCookie(email);

  return NextResponse.json({ ok: true, email, existing: await hasPassword(email) });
}
