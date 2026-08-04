// Proves the webhook rejects anything it cannot cryptographically verify.
//
// Three probes against a running server:
//   1. no signature header          -> 400
//   2. a forged signature           -> 400
//   3. a correctly signed payload   -> 200 and the entitlement is granted
//
// Run:  node scripts/check-webhook.mjs [baseUrl]

import { createHmac } from "crypto";

const base = process.argv[2] ?? "http://localhost:3020";
const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_secret_for_local_probe";

const body = JSON.stringify({
  id: "evt_probe_" + Date.now(),
  object: "event",
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_probe_" + Date.now(),
      object: "payment_intent",
      metadata: { email: "probe@example.com", plan: "blueprint" },
    },
  },
});

function sign(payload, ts) {
  return createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
}

async function post(headers) {
  const res = await fetch(`${base}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  let text = await res.text();
  if (text.length > 120) text = text.slice(0, 120) + "…";
  return { status: res.status, body: text };
}

const ts = Math.floor(Date.now() / 1000);

console.log("1. no signature      ", await post({}));
console.log("2. forged signature  ", await post({ "stripe-signature": `t=${ts},v1=${"0".repeat(64)}` }));
console.log("3. valid signature   ", await post({ "stripe-signature": `t=${ts},v1=${sign(body, ts)}` }));
