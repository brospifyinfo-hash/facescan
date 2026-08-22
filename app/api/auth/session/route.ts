import { NextResponse } from "next/server";
import { clearSessionCookie, currentSession, setSessionCookie } from "@/lib/auth/session";
import { displayName, getProfile } from "@/lib/auth/profile";

export const runtime = "nodejs";

/**
 * Who is signed in, if anyone — and the sliding renewal: every check
 * re-mints the cookie, so the one-year clock restarts on every visit and
 * an active customer stays signed in indefinitely.
 */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ email: null });

  await setSessionCookie(session.email);
  const profile = await getProfile(session.email);
  return NextResponse.json({
    email: session.email,
    name: displayName(session.email, profile),
    picture: profile.picture ?? null,
  });
}

/** Sign out. */
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
