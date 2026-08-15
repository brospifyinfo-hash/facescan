import { NextResponse } from "next/server";
import { kvConfigured } from "@/lib/kv";
import { otpBacking } from "@/lib/auth/store";
import { entitlementBacking, entitlementsEnforceable } from "@/lib/stripe/entitlements";

// Configuration readout.
//
// WHY THIS EXISTS
// ---------------
// Every failure this project has hit in production was invisible from the
// outside: the OTP store silently fell back to memory, the vision route
// silently had no key, a deployment silently kept serving the previous
// build. In each case the code was correct and the environment was not,
// and the only symptom was a user saying "it does not work".
//
// This endpoint answers the one question that would have caught all three:
// what does the running instance actually have?
//
// WHAT IT DELIBERATELY DOES NOT DO
// --------------------------------
// It reports BOOLEANS, never values. Not a key prefix, not a masked key,
// not a URL. "Is a key present" is a configuration fact; any part of the
// key itself is the key. An unauthenticated endpoint that echoes even four
// characters of a secret is a worse bug than the ones it is here to find.
//
// `memory` backings are reported as degraded rather than as a plain fact,
// because in production they are a defect: a login code or a paid
// entitlement written to a process-local Map is lost on the next cold
// start, and the user sees a random failure with no explanation.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const production = process.env.NODE_ENV === "production";
  const otp = otpBacking();
  const ent = entitlementBacking();

  const degraded: string[] = [];
  if (production && otp === "memory") {
    degraded.push("otp store is process-local; codes will fail across instances");
  }
  if (production && ent === "memory") {
    degraded.push("entitlement store is process-local; purchases will be lost");
  }
  if (production && !process.env.AUTH_SECRET) {
    degraded.push("AUTH_SECRET is unset; session minting will throw");
  }
  // Not "degraded" in the sense the others are — nothing is losing data. It
  // is reported because it is the difference between a shop and a demo, and
  // because while it holds, every entitlement gate in the app is standing
  // down rather than refusing. See entitlementsEnforceable().
  if (production && !entitlementsEnforceable()) {
    degraded.push(
      "purchases cannot be granted (stripe key or webhook secret missing); entitlement gates are not enforced",
    );
  }

  return NextResponse.json({
    ok: degraded.length === 0,
    engine: process.env.NEXT_PUBLIC_SCORE_ENGINE === "vision" ? "vision" : "geometry",
    stores: { otp, entitlements: ent, kv: kvConfigured(), entitlementsEnforced: entitlementsEnforceable() },
    configured: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      resend: Boolean(process.env.RESEND_API_KEY),
      authSecret: Boolean(process.env.AUTH_SECRET),
      fromEmail: Boolean(process.env.AUTH_FROM_EMAIL),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    },
    degraded,
  });
}
