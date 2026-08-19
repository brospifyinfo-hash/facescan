import { NextResponse } from "next/server";
import { clearSessionCookie, currentSession, setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Who is signed in, if anyone — and the sliding renewal: every check
 * re-mints the cookie, so the one-year clock restarts on every visit and
 * an active customer stays signed in indefinitely.
 */
export async function GET() {
  const session = await currentSession();
  if (session) await setSessionCookie(session.email);
  return NextResponse.json({ email: session?.email ?? null });
}

/** Sign out. */
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
