import { NextResponse } from "next/server";
import { affiliateStore } from "@/lib/affiliate/store";
import { normalizeCode } from "@/lib/affiliate/codes";
import { setRefCookie } from "@/lib/affiliate/track";

// Node runtime: the cookie is HMAC-signed with node:crypto and the store
// talks to Sheets, neither of which belongs on the edge runtime.
export const runtime = "nodejs";

/** Next 15 hands route params in as a promise. */
type Ctx = { params: Promise<{ code: string }> };

/**
 * Decide where the visitor lands after the referral link is consumed.
 *
 * `?to=` exists so one printed code can point at the quiz, a plan or the
 * home page without minting a second partner code. It is also the classic
 * open-redirect hole: a partner link that forwards to an attacker's login
 * page inherits our domain's credibility, and the partner controls the
 * query string. So only a path on THIS site survives:
 *
 *   "//evil.com"      — protocol-relative, the browser reads it as a host
 *   "/\evil.com"      — a backslash, which several browsers fold to "/"
 *   "https://evil.com" — fails the leading-slash test
 *
 * Anything that is not plainly a local path is dropped for "/" rather than
 * reported, because the visitor did nothing wrong and has somewhere to be.
 */
function safeTarget(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.includes("\\")) return "/";
  return raw;
}

/**
 * The referral link: /r/<CODE>.
 *
 * An unknown, blocked or switched-off code is answered EXACTLY like a valid
 * one — a 302 to the same place, just without the cookie. Anything else (a
 * 404, an error page, a "this code is invalid" banner) turns this endpoint
 * into a code oracle: a script could walk the alphabet and learn which
 * six-character codes exist, which is the first half of impersonating a
 * partner. The only observable difference is a cookie the prober cannot see
 * the meaning of anyway.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { code: rawCode } = await ctx.params;
  const url = new URL(req.url);
  const destination = new URL(safeTarget(url.searchParams.get("to")), req.url);

  const code = normalizeCode(rawCode ?? "");
  if (!code) return NextResponse.redirect(destination, 302);

  try {
    const cfg = await affiliateStore.getConfig();
    if (!cfg.enabled) return NextResponse.redirect(destination, 302);

    const aff = await affiliateStore.affiliateByCode(code);
    // "pending" partners count as valid: their application is on the admin's
    // desk, and dropping the attribution of everyone they told in the
    // meantime would punish them for our approval queue. Whether the
    // commission is ever booked is decided later, at purchase time.
    if (!aff || aff.status === "blocked") return NextResponse.redirect(destination, 302);

    // Cookie first, statistics second. The click counter is one more
    // spreadsheet round trip, and a visitor must never wait on a number
    // that exists purely for a dashboard.
    await setRefCookie(aff.code, cfg.cookieDays);

    try {
      await affiliateStore.bumpClick(aff.code);
    } catch (err) {
      console.error("[affiliate] click counter failed:", err);
    }
  } catch (err) {
    // Store down, config unreadable — the visitor still gets where they were
    // going. A broken partner programme must not swallow traffic.
    console.error("[affiliate] referral redirect degraded:", err);
  }

  return NextResponse.redirect(destination, 302);
}
