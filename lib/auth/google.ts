// "Sign in with Google", verified server-side.
//
// THE CLIENT HANDS US A SIGNED STATEMENT, NOT AN IDENTITY. Google Identity
// Services gives the browser an ID token (a JWT signed by Google); trusting
// its payload without checking the signature would let anyone mint accounts
// with a hand-rolled JWT. So this module fetches Google's published JWKS,
// verifies RS256 with node's own crypto (no dependency), and only then
// believes the email — which must also be marked verified by Google.
//
// The audience check is the other half: a token minted for some OTHER app's
// client id must not open a session here, so `aud` has to equal OUR client
// id exactly. The id itself is public by design (it ships in the page), so
// NEXT_PUBLIC_ is correct; there is no client secret in this flow at all.

import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from "crypto";

const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";

interface GoogleJwk extends JsonWebKey {
  kid?: string;
}

/** Google rotates these on the order of days; an hour of cache is safe. */
let certs: { keys: GoogleJwk[]; at: number } | null = null;

async function googleKeys(): Promise<GoogleJwk[]> {
  if (certs && Date.now() - certs.at < 60 * 60 * 1000) return certs.keys;
  const res = await fetch(CERTS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Google JWKS returned ${res.status}.`);
  const data = (await res.json()) as { keys?: GoogleJwk[] };
  certs = { keys: data.keys ?? [], at: Date.now() };
  return certs.keys;
}

export const googleConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

/**
 * The verified, Google-confirmed email address — or null for anything short
 * of a fully valid token. Null is deliberately the only failure mode: which
 * check failed is logged nowhere and reported nowhere, because every
 * distinction helps only an attacker tuning a forgery.
 */
export async function verifyGoogleIdToken(credential: string): Promise<string | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return null;

  const parts = credential.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  let header: { alg?: string; kid?: string };
  let payload: {
    iss?: string;
    aud?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean;
  };
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (header.alg !== "RS256" || !header.kid) return null;

  let keys: GoogleJwk[];
  try {
    keys = await googleKeys();
  } catch {
    return null;
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;

  try {
    const key = createPublicKey({ key: jwk, format: "jwk" });
    const valid = cryptoVerify(
      "RSA-SHA256",
      Buffer.from(`${h}.${p}`),
      key,
      Buffer.from(s, "base64url"),
    );
    if (!valid) return null;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    return null;
  }
  if (payload.aud !== clientId) return null;
  if (typeof payload.exp !== "number" || payload.exp < now - 60) return null;
  if (payload.email_verified !== true || typeof payload.email !== "string") return null;

  return payload.email;
}

/**
 * The other half of the same trust question, for the ACCESS-token flow.
 *
 * The rendered Google button hands back an ID token; a custom button (which
 * is what this product uses, so the control can look like the rest of the
 * sheet) goes through initTokenClient and hands back an access token
 * instead. An access token is not self-describing, so it is taken to
 * Google's tokeninfo endpoint — which returns the audience it was minted
 * for. CHECKING THAT AUDIENCE IS THE WHOLE POINT: without it, an access
 * token issued to some other application for the same user would open a
 * session here, which is the classic token-substitution hole.
 */
export interface GoogleIdentity {
  email: string;
  name?: string;
  picture?: string;
}

/**
 * The profile Google will hand over for an access token it already
 * accepted. Separate from the verification on purpose: the address is a
 * SECURITY answer and must come from tokeninfo, where the audience is
 * checked, while the name and picture are decoration and may come from
 * userinfo. Mixing the two would mean trusting userinfo for identity.
 */
export async function googleProfile(accessToken: string): Promise<GoogleIdentity | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string; name?: string; picture?: string };
    if (typeof data.email !== "string") return null;
    return { email: data.email, name: data.name, picture: data.picture };
  } catch {
    return null;
  }
}

export async function verifyGoogleAccessToken(accessToken: string): Promise<string | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return null;

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      expires_in?: string | number;
    };

    if (data.aud !== clientId) return null;
    if (typeof data.email !== "string" || data.email.length === 0) return null;
    // tokeninfo answers with strings; both shapes are accepted, nothing else.
    if (data.email_verified !== true && data.email_verified !== "true") return null;
    if (Number(data.expires_in) <= 0) return null;

    return data.email;
  } catch {
    return null;
  }
}
