import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/store";
import {
  googleConfigured,
  googleProfile,
  verifyGoogleAccessToken,
  verifyGoogleIdToken,
} from "@/lib/auth/google";
import { mergeProfile } from "@/lib/auth/profile";

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

  let body: { credential?: string; accessToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // Two shapes, one answer. The button Google renders hands back an ID
  // token; the custom button this product uses goes through
  // initTokenClient and hands back an access token. Both are verified
  // against OUR client id before anything downstream believes the address.
  const credential = typeof body.credential === "string" ? body.credential : "";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  if (!credential && !accessToken) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const verified = credential
    ? await verifyGoogleIdToken(credential)
    : await verifyGoogleAccessToken(accessToken);
  if (!verified) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const email = normalizeEmail(verified);

  // Decoration, and only after the address is proven. A failure here costs
  // an avatar, never a sign-in.
  if (accessToken) {
    const profile = await googleProfile(accessToken);
    if (profile) await mergeProfile(email, { name: profile.name, picture: profile.picture });
  }

  await setSessionCookie(email);
  return NextResponse.json({ ok: true, email });
}
