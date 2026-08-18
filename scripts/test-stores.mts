// Which store is live, and when a missing purchase may be held against you.
//
//   npx tsx scripts/test-stores.mts
//
// THE BUG THIS FILE EXISTS TO PREVENT
// -----------------------------------
// Login codes and entitlements used to fall back to a process-local Map, so
// in production they were lost between instances — sign-in failed at random
// and a purchase evaporated on the next cold start. Moving both onto the
// spreadsheet fixes that, and in doing so it flips
// `entitlementBacking() !== "memory"` from false to true for the first time.
//
// Every entitlement gate in the app was reading exactly that condition to
// decide whether to enforce. So the storage fix, on its own, would have armed
// all of them while Stripe was still unconfigured — and since the Stripe
// webhook is the only thing that ever writes an entitlement, "armed" means
// refusing every customer, including the ones who paid. A pure improvement to
// storage would have taken the product down.
//
// The predicate is therefore three conditions, not one, and the table below
// is the whole point of the file: the row that matters is a persistent store
// with no webhook secret, which must NOT enforce.

import { entitlementsEnforceable, entitlementBacking } from "../lib/stripe/entitlements";
import { otpBacking } from "../lib/auth/store";
import { limitFor, usedFor } from "../lib/history/quota";

let failed = 0;
let checks = 0;
function ok(name: string, cond: boolean, detail = "") {
  checks++;
  if (!cond) failed++;
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const KEYS = [
  "KV_REST_API_URL", "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "SHEETS_URL", "SHEETS_TOKEN",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
] as const;

const saved: Record<string, string | undefined> = {};
for (const k of KEYS) saved[k] = process.env[k];

function env(set: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(set)) process.env[k] = v;
}

const REDIS = { KV_REST_API_URL: "https://x", KV_REST_API_TOKEN: "t" };
const SHEETS = { SHEETS_URL: "https://s/exec", SHEETS_TOKEN: "t" };
const STRIPE = { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" };

// ---------------------------------------------------------------------------
console.log("\nBacking selection — best available wins");

env({});
ok("nothing configured falls back to memory", otpBacking() === "memory" && entitlementBacking() === "memory");

env(SHEETS);
ok("a spreadsheet beats memory", otpBacking() === "sheets" && entitlementBacking() === "sheets");

env(REDIS);
ok("redis is used when only redis is present", otpBacking() === "redis");

env({ ...REDIS, ...SHEETS });
ok(
  "redis still wins when both are present",
  otpBacking() === "redis" && entitlementBacking() === "redis",
  "so connecting Upstash later needs no code change",
);

// ---------------------------------------------------------------------------
console.log("\nMay a missing entitlement be held against a customer?");

env({ ...SHEETS, ...STRIPE });
ok("persistent store + stripe + webhook → enforce", entitlementsEnforceable() === true);

env({ ...REDIS, ...STRIPE });
ok("redis + stripe + webhook → enforce", entitlementsEnforceable() === true);

// The three that must all stand down.
env({ ...STRIPE });
ok(
  "no persistent store → do NOT enforce",
  entitlementsEnforceable() === false,
  "a purchase a minute old may already be gone",
);

env({ ...SHEETS, STRIPE_SECRET_KEY: "sk_test_x" });
ok(
  "no webhook secret → do NOT enforce",
  entitlementsEnforceable() === false,
  "THE ROW THIS FILE IS FOR: the webhook is the only writer",
);

env({ ...SHEETS, STRIPE_WEBHOOK_SECRET: "whsec_x" });
ok("no stripe key → do NOT enforce", entitlementsEnforceable() === false);

env({ ...SHEETS });
ok("store but no stripe at all → do NOT enforce", entitlementsEnforceable() === false);

env({});
ok("nothing at all → do NOT enforce", entitlementsEnforceable() === false);

// ---------------------------------------------------------------------------
console.log("\nWhat that means downstream");

ok(
  "no purchase means the top scan allowance, not the bottom",
  limitFor(null) === 10,
  "SCAN_QUOTA prices a purchase; applied to a non-purchase it capped everyone at one saved scan",
);
ok("a known plan gets exactly its own quota", limitFor("blueprint") === 10 && limitFor("pro") === 1);
ok(
  "a purchase counts from its own grant, not from the account's first scan",
  usedFor("pro", [{ at: 100 }, { at: 200 }, { at: 300 }], 250) === 1,
  "the funnel forces a sign-in (and thus a save) BEFORE checkout — counting lifetime spent the plan's allowance before the purchase existed",
);
ok(
  "without a plan everything counts against the free allowance",
  usedFor(null, [{ at: 100 }, { at: 200 }], 0) === 2,
);

for (const k of KEYS) {
  if (saved[k] === undefined) delete process.env[k];
  else process.env[k] = saved[k]!;
}

console.log(
  failed === 0
    ? `\nALLE TESTS BESTANDEN — ${checks}/${checks} Prüfungen ok`
    : `\n${failed} von ${checks} Prüfungen FEHLGESCHLAGEN`,
);
process.exit(failed === 0 ? 0 : 1);
