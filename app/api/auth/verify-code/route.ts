import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import {
  codeMatches,
  isEmail,
  MAX_ATTEMPTS,
  normalizeEmail,
  otpStore,
} from "@/lib/auth/store";

export const runtime = "nodejs";

/** Exchange a valid code for a session cookie. */
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

  // Single use — burn it before handing out the session.
  await otpStore.delete(email);
  await setSessionCookie(email);

  return NextResponse.json({ ok: true, email });
}
