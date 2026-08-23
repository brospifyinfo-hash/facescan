// The referral cookie, and the one place a cookie turns into a binding.
//
// WHY THE COOKIE IS SIGNED
// ------------------------
// It carries a partner code, and a partner code is a claim on a share of
// every purchase the visitor makes. An unsigned cookie would mean anyone
// could set their own code in the developer console and take a commission on
// their own purchase — a self-service discount that shows up in the books as
// an earned payout. So the value is HMAC-signed with AUTH_SECRET and read
// back with a constant-time comparison, exactly like the session cookie.
//
// The scheme is copied from lib/auth/session.ts (`payload.signature`,
// base64url, an `exp` inside the payload) rather than imported, because the
// secret() helper there is private to that module. Keep the two in step: if
// the session token ever changes shape, this one should follow.
//
// LAST CLICK WINS — but only until a binding exists. The cookie is a hint
// that can still be replaced by the next link the visitor opens; the binding
// in the store is permanent and is never overwritten by this file.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { normalizeEmail } from "@/lib/auth/store";
import { entitlements } from "@/lib/stripe/entitlements";
import { affiliateStore } from "@/lib/affiliate/store";
import { normalizeCode } from "@/lib/affiliate/codes";

export const REF_COOKIE = "facescan_ref";

const DEV_SECRET = "facescan-dev-only-not-for-production";

/** Mirrors secret() in lib/auth/session.ts — see the header for why it is copied. */
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    // Refuse to mint forgeable referral tokens in production, for the same
    // reason sessions refuse: a forgeable one is a self-issued commission.
    throw new Error("AUTH_SECRET is missing or too short. Set a random 32+ character value.");
  }
  return DEV_SECRET;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

interface RefPayload {
  code: string;
  exp: number;
}

export function signRef(code: string, days: number): string {
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        code: normalizeCode(code),
        exp: Date.now() + Math.max(1, Math.round(days)) * 86_400_000,
      } satisfies RefPayload),
    ),
  );
  return `${payload}.${sign(payload)}`;
}

/**
 * The code inside a token, or null.
 *
 * Null for every failure alike — missing, malformed, wrong signature,
 * expired. The caller has nothing useful to do with the difference, and a
 * distinguishable answer would tell a forger which half they got right.
 */
export function readRef(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  // Length first: timingSafeEqual throws on a mismatch rather than returning
  // false, and a thrown error here would take down whatever page read it.
  if (expected.length !== given.length) return null;
  if (!timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RefPayload;
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    const code = normalizeCode(typeof data.code === "string" ? data.code : "");
    return code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

export async function setRefCookie(code: string, days: number): Promise<void> {
  const jar = await cookies();
  jar.set(REF_COOKIE, signRef(code, days), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax", not "strict": the whole point is that the visitor arrives from
    // Instagram, a newsletter or a printed QR code, and "strict" would drop
    // the cookie on exactly those cross-site navigations.
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, Math.round(days)) * 86_400,
  });
}

export async function currentRef(): Promise<string | null> {
  const jar = await cookies();
  return readRef(jar.get(REF_COOKIE)?.value);
}

export async function clearRefCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(REF_COOKIE);
}

/**
 * Turn a referral cookie into a permanent binding, if the rules allow it.
 *
 * Called from all three login paths the moment a session comes into
 * existence, which is the first moment the visitor has a name. Lives in one
 * function rather than three copies so the rules below cannot drift apart.
 *
 * IT NEVER THROWS. It hangs in the sign-in path, and a partner programme that
 * cannot write a counter must not be able to stop somebody logging in. Every
 * failure is logged with an "[affiliate]" prefix and swallowed.
 */
export async function bindReferralIfAny(email: string): Promise<void> {
  try {
    const code = await currentRef();
    if (!code) return;

    const outcome = await bindReferral(email, code);

    // A cookie is cleared once its question has a final answer. "disabled"
    // and "inactive" are not final — the owner may switch the programme back
    // on, or approve the partner, while the cookie is still alive — so those
    // two keep it and everything else drops it.
    if (outcome !== "disabled" && outcome !== "inactive" && outcome !== "no_customer") {
      await clearRefCookie();
    }
  } catch (err) {
    console.error("[affiliate] binding a referral failed", err);
  }
}

/**
 * Every rule that decides whether a customer belongs to a partner, with the
 * code handed in rather than read from a cookie.
 *
 * SPLIT OUT SO IT CAN BE TESTED. `cookies()` only exists inside a request, so
 * as long as these rules lived behind the cookie read they could not be run in
 * `scripts/test-affiliate.mts` — and "self-referral is rejected" is exactly
 * the kind of rule that silently stops being true. The caller above owns the
 * cookie; this function owns the rules.
 *
 * Returns what happened, so the caller knows whether the cookie still has a
 * job. Never throws.
 */
export async function bindReferral(
  email: string,
  rawCode: string,
): Promise<
  | "bound"
  | "no_customer"
  | "disabled"
  | "unknown_code"
  | "inactive"
  | "self_referral"
  | "already_bound"
  | "existing_customer"
  | "error"
> {
  try {
    const code = normalizeCode(rawCode ?? "");
    if (!code) return "unknown_code";

    const customer = normalizeEmail(email);
    if (!customer) return "no_customer";

    const cfg = await affiliateStore.getConfig();
    // Programme switched off: the visitor who came through a partner link
    // still counts as theirs if the owner turns it back on this week.
    if (!cfg.enabled) return "disabled";

    const aff = await affiliateStore.affiliateByCode(code);
    // A code nobody owns is a dead cookie — not worth carrying for two months.
    if (!aff) return "unknown_code";

    // "pending" can still become "active" while the cookie is alive, and
    // "blocked" is kept for the same reason a blocked partner is not deleted:
    // the admin may undo it.
    if (aff.status !== "active") return "inactive";

    if (cfg.selfReferralBlocked && normalizeEmail(aff.email) === customer) {
      console.warn("[affiliate] self-referral ignored for code", aff.code);
      return "self_referral";
    }

    const existing = await affiliateStore.getBinding(customer);
    if (existing) {
      // NEVER overwritten here. Whoever introduced this customer keeps them;
      // only the admin can move a binding. Without this rule the last link a
      // long-standing customer happened to click would take the commission
      // away from the partner who actually brought them.
      return "already_bound";
    }

    // An existing customer cannot be "referred" — they were already ours
    // before the link was clicked, and paying a commission on their next
    // purchase would be paying for work nobody did.
    const owned = await entitlements.get(customer);
    if (owned) {
      console.warn("[affiliate] existing customer not bound to code", aff.code);
      return "existing_customer";
    }

    await affiliateStore.putBinding({
      affiliateEmail: normalizeEmail(aff.email),
      code: aff.code,
      boundAt: Date.now(),
      source: "link",
      firstPurchaseAt: null,
      customerEmail: customer,
    });
    await affiliateStore.bumpSummary(aff.email, { signups: 1 });
    return "bound";
  } catch (err) {
    console.error("[affiliate] binding a referral failed", err);
    return "error";
  }
}
