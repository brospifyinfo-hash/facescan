import { NextResponse } from "next/server";
import { currentSession, setSessionCookie } from "@/lib/auth/session";
import { entitlements } from "@/lib/stripe/entitlements";
import { isStripeConfigured, stripe } from "@/lib/stripe/server";
import { mayClaim } from "@/lib/stripe/claim";
import { sendPurchaseReceipt } from "@/lib/stripe/receipt";

export const runtime = "nodejs";

/**
 * Grant from a payment the customer can point at, when the webhook did not
 * arrive.
 *
 * WHY THIS EXISTS. The webhook is the normal grantor and stays that way, but
 * it is a PUSH: Stripe has to reach us. If the endpoint is misconfigured, in
 * the wrong mode, temporarily unreachable, or simply slower than the poll
 * window, the customer has paid and the app never finds out. Everything else
 * in the flow is correct and the person is still locked out of what they
 * bought — the worst state this product can be in.
 *
 * This is the same fact, PULLED. The intent is fetched from Stripe by id, and
 * the answer comes from Stripe rather than from the browser.
 *
 * THE INVARIANT HOLDS: THE CLIENT STILL GRANTS ITSELF NOTHING. It supplies an
 * id and nothing else. Three things are then checked against Stripe's own
 * record, and all three must hold:
 *
 *   1. the intent actually succeeded,
 *   2. its metadata names a plan we sell,
 *   3. its metadata names THIS session's address.
 *
 * Without (3) this would be a way to claim somebody else's payment by
 * guessing an id — a far worse bug than the one it fixes.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 501 });
  }

  // OHNE SITZUNG GEHT ES JETZT AUCH — DIE ZAHLUNG SELBST IST DER AUSWEIS.
  //
  // Wer als Gast gekauft hat, hat kein Konto und trotzdem bezahlt. Ihm hier
  // 401 zu geben hiesse, ihm sein Produkt vorzuenthalten, weil er sich nicht
  // angemeldet hat — genau die Huerde, die gerade fallen sollte.
  //
  // Was an die Stelle der Sitzung tritt, ist die Intent-Kennung. Sie ist ein
  // Inhaberausweis: nur der Browser, der bezahlt hat, kennt sie, sie hat
  // genug Entropie, um nicht geraten zu werden, und alles Weitere kommt aus
  // Stripes eigenem Datensatz — nicht aus dem Aufruf.
  //
  // Die dritte Pruefung aus mayClaim bleibt fuer angemeldete Kunden scharf:
  // eine fremde Kennung schaltet dort nichts frei. Fuer Gaeste faellt sie
  // weg, und das ist vertretbar, WEIL /api/stripe/create-payment-intent
  // Gastkaeufe auf Adressen beschraenkt, die noch niemandem gehoeren. Auf
  // eine fremde Adresse kann also gar kein Gast-Intent entstehen.
  let session: Awaited<ReturnType<typeof currentSession>> = null;
  try {
    session = await currentSession();
  } catch {
    session = null;
  }

  let body: { paymentIntentId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const id = typeof body.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
  // Shape check before spending a Stripe round trip on obvious junk.
  if (!/^pi_[A-Za-z0-9_]{8,}$/.test(id)) {
    return NextResponse.json({ error: "invalid_intent" }, { status: 400 });
  }

  try {
    const intent = await stripe().paymentIntents.retrieve(id);

    // Ohne Sitzung ist die Adresse aus Stripes Metadaten massgeblich — die
    // hat unser Server beim Anlegen des Intents geschrieben, nicht der
    // Aufrufer.
    const claimant = session?.email ?? intent.metadata?.email ?? "";
    const verdict = mayClaim(intent, claimant);
    if (!verdict.ok) {
      if (verdict.reason !== "not_paid") {
        console.warn(`[stripe] confirm refused (${verdict.reason})`, intent.id);
      }
      return NextResponse.json(
        { error: verdict.reason },
        { status: verdict.reason === "not_yours" ? 403 : 409 },
      );
    }
    const { plan } = verdict;
    const owner = session?.email ?? claimant;

    // Der Gast bekommt jetzt eine Sitzung — sonst waere sein Kauf beim
    // naechsten Neuladen verschwunden, weil /api/stripe/entitlement eine
    // braucht. Sie wird aus dem BESTAETIGTEN Datensatz gesetzt, nicht aus
    // einer Eingabe: Stripe hat die Zahlung als erfolgreich gemeldet und die
    // Adresse stammt aus den Metadaten, die dieser Server geschrieben hat.
    if (!session) {
      await setSessionCookie(owner).catch(() => {
        // Eine Sitzung, die nicht gesetzt werden kann, darf die
        // Freischaltung nicht verhindern — der Kunde hat bezahlt.
      });
    }

    // Both are idempotent — grant keeps the higher tier, recordPayment
    // deduplicates by intent id — so racing the webhook is harmless.
    // THE TWO WRITES GO TOGETHER. Each is a spreadsheet round trip of
    // roughly two seconds and neither depends on the other, so running them
    // in sequence simply made the customer wait for both. They stay
    // separately idempotent — grant keeps the higher tier, recordPayment
    // deduplicates by intent id — so racing the other grant path is still
    // harmless.
    await Promise.all([
      entitlements.grant(owner, {
        plan,
        paymentIntentId: intent.id,
        grantedAt: Date.now(),
      }),
      entitlements.recordPayment(owner, {
        plan,
        paymentIntentId: intent.id,
        amount: typeof intent.amount === "number" ? intent.amount : null,
        currency: intent.currency ?? null,
        at: Date.now(),
      }),
    ]);

    // Beide Freischaltungswege muenden hier in denselben Beleg. Welcher
    // zuerst da ist, entscheidet der Marker in sendPurchaseReceipt — der
    // Kunde bekommt ihn genau einmal.
    await sendPurchaseReceipt({
      email: owner,
      plan,
      amountMinor: typeof intent.amount === "number" ? intent.amount : null,
      currency: intent.currency ?? null,
      paymentIntentId: intent.id,
      locale: intent.metadata?.locale ?? null,
    });

    console.info(`[stripe] confirm granted ${plan} to ${owner} (${intent.id})`);
    return NextResponse.json({ plan });
  } catch (err) {
    console.error("[stripe] confirm failed:", err);
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }
}
