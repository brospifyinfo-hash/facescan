import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { isEmail, normalizeEmail } from "@/lib/auth/store";
import { checkPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

/**
 * Sign in with the account password.
 *
 * Every failure short of "correct" answers with the SAME error token: which
 * of "no such account", "no password set" and "wrong password" applied is
 * exactly what an enumerator wants to learn, and the customer's remedy is
 * identical in all three cases (use the code, or type it again). "locked"
 * and "unavailable" are the only distinct answers, because the customer has
 * to be told to wait rather than to retype.
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  if (!isEmail(email) || typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await checkPassword(email, password);
  if (result === "locked") {
    return NextResponse.json({ error: "locked" }, { status: 429 });
  }
  if (result === "unavailable") {
    // The limiter cannot see this attempt, so it must not proceed — an
    // unmetered password endpoint is a brute-force target.
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (result !== "ok") {
    return NextResponse.json({ error: "wrong_password" }, { status: 400 });
  }

  await setSessionCookie(email);
  return NextResponse.json({ ok: true, email });
}
