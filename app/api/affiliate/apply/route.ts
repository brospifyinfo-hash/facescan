import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { currentSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/store";
import { skGetJson, skSetJson, sheetsKvConfigured, sheetsKvHealthy } from "@/lib/sheets-kv";
import { applyForAffiliate } from "@/lib/affiliate/apply";
import { affiliateStore } from "@/lib/affiliate/store";
import { siteOrigin } from "@/lib/affiliate/email";
import { effectiveMinCents } from "@/lib/affiliate/payouts";
import {
  affiliateLink,
  levelFor,
  percentFor,
  type Affiliate,
  type AffiliateConfig,
} from "@/lib/affiliate/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Becoming a partner.
//
// The rules live in lib/affiliate/apply.ts — this route contributes exactly
// two things: it takes the identity from the session rather than the body
// (an application is a bank account attached to an account, and letting the
// body name the account would let anyone attach theirs to somebody else's),
// and it throttles.
//
// WHY THE THROTTLE IS HERE AND NOT IN apply.ts
// The form posts an IBAN. Unlimited attempts against a mod-97 check is a way
// to grind out valid account numbers, and unlimited attempts against the
// invite-code check is a way to guess a code out of a 32-symbol alphabet.
// Five per hour is far above what a person filling in a form needs and far
// below what either attack needs.

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

interface RateRecord {
  count: number;
  /** Absolute, so a refreshed row cannot silently extend its own window. */
  resetAt: number;
}

/**
 * The fallback counter for the memory floor.
 *
 * Pinned to globalThis for the same reason the affiliate store is: a dev
 * server hot-reloads this module and a plain module-level Map would reset
 * the limit on every edit. It is still per-process and therefore not a real
 * limit in production — which is fine, because in production the spreadsheet
 * is configured and the branch below never runs.
 */
declare global {
  // eslint-disable-next-line no-var
  var __facescanAffiliateApplyRate: Map<string, RateRecord> | undefined;
}
const memoryRate: Map<string, RateRecord> =
  globalThis.__facescanAffiliateApplyRate ??
  (globalThis.__facescanAffiliateApplyRate = new Map());

/**
 * Count this attempt and report whether it is allowed.
 *
 * Fails OPEN on a store error: a partner who cannot apply because the
 * spreadsheet timed out is a lost partner, and the thing being protected
 * here is a nuisance, not money. Every rule that actually guards a payout is
 * enforced in lib/affiliate and fails closed there.
 */
async function allowAttempt(email: string): Promise<boolean> {
  const key = `affrate:${email}`;
  const now = Date.now();

  if (sheetsKvConfigured() && sheetsKvHealthy()) {
    try {
      const stored = await skGetJson<RateRecord>(key);
      const record =
        stored && typeof stored.resetAt === "number" && stored.resetAt > now
          ? stored
          : { count: 0, resetAt: now + RATE_WINDOW_MS };
      if (record.count >= RATE_LIMIT) return false;
      // The TTL is the remainder of the window, not a fresh hour — writing a
      // full hour on every attempt would let a persistent caller push their
      // own window forward for ever.
      await skSetJson(key, { count: record.count + 1, resetAt: record.resetAt }, record.resetAt - now);
      return true;
    } catch (err) {
      console.error("[affiliate] application rate limit unavailable:", err);
      return true;
    }
  }

  const record = memoryRate.get(key);
  const live = record && record.resetAt > now ? record : { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (live.count >= RATE_LIMIT) return false;
  memoryRate.set(key, { count: live.count + 1, resetAt: live.resetAt });
  return true;
}

/**
 * The masked IBAN, from the two fields stored in the clear — never by
 * decrypting. The plaintext belongs in the admin reveal and the payout
 * export, nowhere else.
 */
function maskedIban(aff: Affiliate): string {
  const country = (aff.ibanCountry || "").toUpperCase().slice(0, 2);
  const last4 = aff.ibanLast4 || "";
  if (!country && !last4) return "";
  return `${country || "??"}•• •••• ${last4 || "????"}`;
}

async function qrFor(link: string): Promise<string | null> {
  try {
    return await QRCode.toString(link, {
      type: "svg",
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    });
  } catch (err) {
    console.error("[affiliate] QR code rendering failed:", err);
    return null;
  }
}

/**
 * The same shape GET /api/affiliate/me returns under `affiliate`, so the
 * page can drop this straight into its state and show the finished dashboard
 * without a second round trip.
 */
async function publicAffiliate(aff: Affiliate, cfg: AffiliateConfig) {
  const origin = siteOrigin();
  const link = affiliateLink(origin, aff.code);
  const summary = await affiliateStore.getSummary(aff.email);
  const current = levelFor(summary.payingCustomers, cfg, aff.levelOverride);

  return {
    code: aff.code,
    status: aff.status,
    link,
    qrSvg: aff.status === "active" ? await qrFor(link) : null,
    firstName: aff.firstName,
    lastName: aff.lastName,
    address: aff.address,
    accountHolder: aff.accountHolder,
    ibanMasked: maskedIban(aff),
    createdAt: aff.createdAt,
    level: current.level,
    levelLabel: current.label,
    percent: percentFor(aff, cfg, summary.payingCustomers),
    minCents: effectiveMinCents(aff, cfg),
  };
}

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const email = normalizeEmail(session.email);
  if (!(await allowAttempt(email))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input", field: "body" }, { status: 400 });
  }

  const result = await applyForAffiliate(email, body);
  if (!result.ok) {
    // `field` tells the form which input to mark; the error code carries the
    // rest. No stack trace, no store detail — the client gets a decision.
    return NextResponse.json({ error: result.error, field: result.field }, { status: result.status });
  }

  try {
    const cfg = await affiliateStore.getConfig();
    return NextResponse.json({ ok: true, affiliate: await publicAffiliate(result.affiliate, cfg) });
  } catch (err) {
    // The partner IS registered at this point. Reporting a failure now would
    // send them back to the form and straight into "already_affiliate", so
    // the answer stays a success and the page simply reloads its state.
    console.error("[affiliate] could not render the new partner record:", err);
    return NextResponse.json({ ok: true, affiliate: null });
  }
}
