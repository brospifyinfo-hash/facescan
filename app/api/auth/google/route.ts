import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/store";
import { googleConfigured, verifyGoogleIdToken } from "@/lib/auth/google";

export const runtime = "nodejs";

/**
 * Exchange a Google ID token for a session.
 *
 * Google already proved the inbox (email_verified is required in the
 * verifier), so this is exactly as strong as the OTP path: both end in
 * "this person controls this address". The session that comes out is the
 * same cookie either way — nothing downstream knows or cares how the
 * address was proven.
 */
export async function POST(req: Request) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }

  let body: { credential?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body.credential !== "string" || body.credential.length === 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const verified = await verifyGoogleIdToken(body.credential);
  if (!verified) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const email = normalizeEmail(verified);
  await setSessionCookie(email);
  return NextResponse.json({ ok: true, email });
}
