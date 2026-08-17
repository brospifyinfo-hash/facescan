// The money path: a signed Stripe event in, an entitlement out.
//
//   npx tsx scripts/test-purchase.mts
//
// WHY THIS CAN BE TESTED AT ALL WITHOUT STRIPE
// --------------------------------------------
// Webhook signature verification is pure HMAC over the raw body — no network,
// no account, no live key. So the whole chain can be exercised offline with a
// throwaway secret: build the event, sign it the way Stripe signs it, hand it
// to the real route handler, and look at what the store holds afterwards.
//
// WHY IT IS WORTH TESTING
// -----------------------
// This is the only code path in the product that turns money into access, and
// until now it had never been run — Stripe is unconfigured in production, so
// the first execution would have been a real customer's real payment. The
// failure modes are all silent from the outside: a signature check that
// accepts anything is a free unlock button, a replay that grants twice
// corrupts the receipts, and metadata read from the wrong place grants the
// wrong tier. None of those show up as an error; they show up as money.
//
// THE FORGERY CHECK IS THE POINT. Everything else here is correctness; that
// one is the difference between a shop and a giveaway.

import { createHmac } from "node:crypto";

// Must be set before the modules that read them are loaded. Any string works:
// the secret is only ever compared against a signature computed with the same
// secret, and the "key" is never used to reach Stripe.
process.env.STRIPE_SECRET_KEY = "sk_test_offline";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_offline_testing_secret";
// No persistent store: the memory entitlement store is exactly what this test
// wants to inspect, and it keeps the run off the network entirely.
for (const k of [
  "KV_REST_API_URL", "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "SHEETS_URL", "SHEETS_TOKEN",
]) delete process.env[k];

const { POST } = await import("../app/api/stripe/webhook/route");
const { entitlements } = await import("../lib/stripe/entitlements");
const { can } = await import("../lib/pricing");

let failed = 0;
let checks = 0;
function ok(name: string, cond: boolean, detail = "") {
  checks++;
  if (!cond) failed++;
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

/** Exactly the header format Stripe sends. */
function sign(payload: string, secret = SECRET, at = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac("sha256", secret).update(`${at}.${payload}`).digest("hex");
  return `t=${at},v1=${mac}`;
}

function event(id: string, email: string, plan: string, amount = 1895) {
  return JSON.stringify({
    id,
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: `pi_${id}`,
        object: "payment_intent",
        amount,
        currency: "eur",
        metadata: { email, plan },
      },
    },
  });
}

const post = (body: string, signature: string | null) =>
  POST(
    new Request("https://x/api/stripe/webhook", {
      method: "POST",
      headers: signature ? { "stripe-signature": signature } : {},
      body,
    }),
  );

// ---------------------------------------------------------------------------
console.log("\nA genuine purchase");

const buyer = "kunde@example.com";
let res = await post(event("evt_1", buyer, "blueprint"), sign(event("evt_1", buyer, "blueprint")));
ok("the webhook accepts a correctly signed event", res.status === 200, `HTTP ${res.status}`);

const ent = await entitlements.get(buyer);
ok("an entitlement was granted", ent !== null);
ok("it names the plan from the intent metadata", ent?.plan === "blueprint", String(ent?.plan));
ok("it records which payment bought it", ent?.paymentIntentId === "pi_evt_1");

const pays = await entitlements.payments(buyer);
ok("a receipt line was written", pays.length === 1);
ok("the receipt keeps the amount as charged", pays[0]?.amount === 1895 && pays[0]?.currency === "eur");

ok("the purchase opens the hairstyle studio", can(ent!.plan, "hairstyle") === true);
ok("and the download", can(ent!.plan, "download") === true);

// ---------------------------------------------------------------------------
console.log("\nForgery and replay");

// The one that matters: an attacker posting the same shape with no valid MAC.
const forged = event("evt_forged", "angreifer@example.com", "blueprint");
res = await post(forged, "t=1,v1=deadbeef");
ok("a bad signature is refused", res.status === 400, `HTTP ${res.status}`);
ok("and grants nothing", (await entitlements.get("angreifer@example.com")) === null);

res = await post(forged, null);
ok("a missing signature is refused", res.status === 400);

// Signed with the wrong secret — the case a rotated key produces.
res = await post(forged, sign(forged, "whsec_a_different_secret"));
ok("a signature from another secret is refused", res.status === 400);
ok("still nothing granted", (await entitlements.get("angreifer@example.com")) === null);

// Stripe retries until it gets a 2xx, so this happens in normal operation.
const replay = event("evt_1", buyer, "blueprint");
res = await post(replay, sign(replay));
ok("a replayed event is acknowledged", res.status === 200);
ok(
  "and does not add a second receipt",
  (await entitlements.payments(buyer)).length === 1,
  String((await entitlements.payments(buyer)).length),
);

// ---------------------------------------------------------------------------
console.log("\nUpgrades and junk");

const climber = "aufsteiger@example.com";
const pro = event("evt_pro", climber, "pro");
await post(pro, sign(pro));
ok("a pro purchase grants pro", (await entitlements.get(climber))?.plan === "pro");
ok("pro cannot reach the studio", can("pro", "hairstyle") === false);

const up = event("evt_up", climber, "blueprint");
await post(up, sign(up));
ok("upgrading to blueprint wins", (await entitlements.get(climber))?.plan === "blueprint");
ok("both charges are on the receipt", (await entitlements.payments(climber)).length === 2);

const down = event("evt_down", climber, "raw");
await post(down, sign(down));
ok(
  "a LOWER tier never downgrades what was already bought",
  (await entitlements.get(climber))?.plan === "blueprint",
  "otherwise a cheap second purchase revokes the expensive one",
);

const junk = event("evt_junk", "leer@example.com", "not_a_plan");
res = await post(junk, sign(junk));
ok("an unknown plan is acknowledged, not crashed on", res.status === 200);
ok("and grants nothing", (await entitlements.get("leer@example.com")) === null);

const noEmail = JSON.stringify({
  id: "evt_noemail",
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_x", amount: 195, currency: "eur", metadata: { plan: "raw" } } },
});
res = await post(noEmail, sign(noEmail));
ok("an intent with no email is acknowledged, not crashed on", res.status === 200);

// ---------------------------------------------------------------------------
console.log("\nMehrere Signing Secrets");

// A signing secret belongs to one endpoint, so anyone running test beside
// live has two. With a single configured value the other endpoint's
// deliveries all fail verification — indistinguishable from an attack in the
// logs, and from silence to the customer.
const SECOND = "whsec_a_second_endpoint";
process.env.STRIPE_WEBHOOK_SECRET = `${SECRET},${SECOND}`;

const viaFirst = event("evt_m1", "erst@example.com", "pro");
res = await post(viaFirst, sign(viaFirst, SECRET));
ok("an event signed with the FIRST secret is accepted", res.status === 200);
ok("and grants", (await entitlements.get("erst@example.com"))?.plan === "pro");

const viaSecond = event("evt_m2", "zweit@example.com", "blueprint");
res = await post(viaSecond, sign(viaSecond, SECOND));
ok(
  "an event signed with the SECOND secret is accepted",
  res.status === 200,
  "returning early on the first mismatch would make this endpoint useless",
);
ok("and grants", (await entitlements.get("zweit@example.com"))?.plan === "blueprint");

// The guarantee that matters: more secrets must not mean weaker checking.
const stranger = event("evt_m3", "fremd@example.com", "blueprint");
res = await post(stranger, sign(stranger, "whsec_neither_of_them"));
ok("a third, unknown secret is still refused", res.status === 400);
ok("and grants nothing", (await entitlements.get("fremd@example.com")) === null);

// A trailing comma must not produce an empty secret that gets tried.
process.env.STRIPE_WEBHOOK_SECRET = `${SECRET},`;
const trailing = event("evt_m4", "komma@example.com", "raw");
res = await post(trailing, sign(trailing, SECRET));
ok("a trailing comma is ignored", res.status === 200);
res = await post(trailing, "t=1,v1=deadbeef");
ok("and does not open a hole", res.status === 400);

process.env.STRIPE_WEBHOOK_SECRET = SECRET;

console.log(
  failed === 0
    ? `\nALLE TESTS BESTANDEN — ${checks}/${checks} Prüfungen ok`
    : `\n${failed} von ${checks} Prüfungen FEHLGESCHLAGEN`,
);
process.exit(failed === 0 ? 0 : 1);
