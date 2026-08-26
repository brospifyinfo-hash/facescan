import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Is the webhook wired up — and does it point HERE?
//
// The webhook is the single point where a purchase becomes an entitlement and
// a commission. When it is missing, misaddressed or signed with a secret this
// deployment does not know, everything upstream looks perfect: the customer
// pays, Stripe says succeeded, and the app never hears about it. The customer
// has no product and the partner has no commission, and nothing anywhere
// reports an error, because from the app's side simply nothing happened.
//
// /api/health only reports that STRIPE_WEBHOOK_SECRET is set. That is true for
// a secret belonging to a different endpoint, and for a live-mode secret on a
// test-mode deployment — both of which fail signature verification on every
// single delivery.
//
// Read-only: listing endpoints charges nothing and changes nothing.

interface Endpoint {
  url?: string;
  status?: string;
  enabled_events?: string[];
  api_version?: string | null;
}

/** The two the affiliate and entitlement paths actually depend on. */
const REQUIRED = ["payment_intent.succeeded", "charge.refunded"];

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const secrets = (process.env.STRIPE_WEBHOOK_SECRET ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const mode = key.startsWith("sk_test")
    ? "test"
    : key.startsWith("sk_live")
      ? "live"
      : key
        ? "unknown"
        : "unset";

  const base = {
    mode,
    // Which secrets, not what they are. The count matters because one variable
    // may legitimately hold several — test beside live, or during a rotation.
    webhookSecrets: secrets.length,
    webhookSecretModes: secrets.map((s) => (s.startsWith("whsec_") ? "whsec" : "malformed")),
    expectedUrl: new URL("/api/stripe/webhook", req.url).toString(),
  };

  if (!key) return NextResponse.json({ ...base, ok: false, problem: "no_key" });

  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=20", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json({
      ...base,
      ok: false,
      problem: "unreachable",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const body = (await res.json().catch(() => null)) as
    | { data?: Endpoint[]; error?: { message?: string } }
    | null;

  if (!res.ok) {
    return NextResponse.json({
      ...base,
      ok: false,
      problem: "key_rejected",
      detail: body?.error?.message ?? `HTTP ${res.status}`,
    });
  }

  const host = new URL(req.url).host;
  const endpoints = (body?.data ?? []).map((e) => {
    const events = e.enabled_events ?? [];
    // "*" is Stripe's "send everything", which covers the two we need.
    const covers = events.includes("*") || REQUIRED.every((r) => events.includes(r));
    return {
      url: e.url ?? "",
      status: e.status ?? "unknown",
      pointsHere: (e.url ?? "").includes(host),
      coversRequiredEvents: covers,
      missingEvents: covers ? [] : REQUIRED.filter((r) => !events.includes(r)),
    };
  });

  const live = endpoints.filter((e) => e.pointsHere && e.status === "enabled");
  const good = live.filter((e) => e.coversRequiredEvents);
  const ok = good.length > 0 && secrets.length > 0;

  return NextResponse.json({
    ...base,
    ok,
    endpoints,
    problem: ok
      ? null
      : endpoints.length === 0
        ? "no_endpoint"
        : live.length === 0
          ? "no_endpoint_for_this_host"
          : good.length === 0
            ? "events_missing"
            : "no_secret",
    detail: ok
      ? `Der Webhook zeigt auf ${host} und sendet die nötigen Ereignisse. Käufe erzeugen Entitlements und Provisionen.`
      : endpoints.length === 0
        ? `Im ${mode === "test" ? "Testmodus" : "Konto"} ist kein Webhook-Endpunkt angelegt. Ohne ihn erfährt die Seite nie von einem Kauf: kein Zugang, keine Provision.`
        : live.length === 0
          ? `Kein aktiver Endpunkt zeigt auf ${host}. Vorhanden: ${endpoints.map((e) => e.url).join(", ")}`
          : good.length === 0
            ? `Der Endpunkt sendet nicht alle nötigen Ereignisse. Es fehlen: ${good.length === 0 ? live[0]?.missingEvents.join(", ") : ""}`
            : "STRIPE_WEBHOOK_SECRET ist nicht gesetzt — jede Zustellung scheitert an der Signaturprüfung.",
  });
}
