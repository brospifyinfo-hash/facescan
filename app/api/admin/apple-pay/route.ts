import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { isStripeConfigured, stripe } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apple Pay einschalten, ohne das Stripe-Dashboard zu durchsuchen.
//
// WARUM APPLE PAY NICHT ERSCHIEN
//
// Das ExpressCheckoutElement zeigt eine Wallet nur, wenn der Browser sie
// anbietet UND die Domain beim Zahlungsdienstleister registriert ist. Fehlt
// die Registrierung, rendert das Element schlicht nichts — kein Fehler, kein
// Hinweis, nur eine leere Stelle. Von aussen sieht das exakt so aus wie
// "Apple Pay geht nicht", und man sucht die Ursache im Code, wo sie nicht
// liegt.
//
// Registrierung heisst bei Stripe zweierlei: die Zuordnungsdatei muss unter
// /.well-known/... ausgeliefert werden (das erledigt
// app/api/apple-pay-domain-association), und die Domain muss ueber die API
// oder das Dashboard angemeldet sein. Das ist die API-Haelfte.
//
// GET prueft und aendert nichts. POST meldet an. Beides nur fuer den
// Betreiber — wer eine fremde Domain in ein fremdes Stripe-Konto haengen
// kann, kann dort Unsinn anrichten.
//
// TEST UND LIVE SIND GETRENNT. Die Registrierung gilt fuer den Modus des
// Schluessels, mit dem sie vorgenommen wurde. Wer im Testmodus registriert
// und live verkauft, hat nichts gewonnen — deshalb meldet die Antwort den
// Modus mit.

interface Domain {
  id: string;
  domain_name: string;
  livemode: boolean;
}

const modeOf = (key: string) =>
  key.startsWith("sk_live") ? "live" : key.startsWith("sk_test") ? "test" : "unknown";

/** Die Domain, unter der diese Instanz gerade beantwortet wurde. */
const hostOf = (req: Request) => new URL(req.url).host;

/** Liefert unsere eigene Zuordnungsdatei aus? Stripe fragt genau das ab. */
async function associationReachable(host: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://${host}/.well-known/apple-developer-merchantid-domain-association`,
      { cache: "no-store" },
    );
    if (!res.ok) return false;
    const body = (await res.text()).trim();
    // Die Datei ist hex-kodiertes JSON. Eine HTML-Fehlerseite mit Status 200
    // — das, was eine fehlende Umschreibung produziert — faellt hier durch.
    return body.length > 1000 && /^[0-9A-Fa-f]+$/.test(body);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 501 });
  }

  const host = hostOf(req);
  const mode = modeOf(process.env.STRIPE_SECRET_KEY ?? "");

  let domains: Domain[] = [];
  let listError: string | null = null;
  try {
    const res = await stripe().applePayDomains.list({ limit: 50 });
    domains = res.data as unknown as Domain[];
  } catch (err) {
    listError = err instanceof Error ? err.message : String(err);
  }

  const fileOk = await associationReachable(host);
  const registered = domains.some((d) => d.domain_name === host);

  return NextResponse.json({
    mode,
    host,
    fileServed: fileOk,
    registered,
    domains: domains.map((d) => d.domain_name),
    listError,
    ok: fileOk && registered && listError === null,
    detail: listError
      ? `Stripe konnte die Domainliste nicht liefern: ${listError}`
      : !fileOk
        ? `Die Zuordnungsdatei ist unter https://${host}/.well-known/apple-developer-merchantid-domain-association nicht abrufbar. Ohne sie lehnt Stripe die Registrierung ab.`
        : registered
          ? `${host} ist im ${mode === "live" ? "Live" : "Test"}-Modus registriert. Apple Pay erscheint auf Apple-Geräten mit hinterlegter Karte.`
          : `Die Datei wird ausgeliefert, aber ${host} ist noch nicht registriert. Ein POST auf diese Adresse meldet sie an.`,
  });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 501 });
  }

  const body = (await req.json().catch(() => null)) as { domain?: unknown } | null;
  const requested = typeof body?.domain === "string" ? body.domain.trim() : "";
  const host = requested || hostOf(req);

  // Nur ein Hostname, nichts mit Schema, Pfad oder Port. Was hier durchgeht,
  // wandert unveraendert in das Stripe-Konto.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) {
    return NextResponse.json({ error: "invalid_domain", host }, { status: 400 });
  }

  // ERST PRUEFEN, DANN ANMELDEN. Stripe holt die Datei selbst ab und
  // antwortet sonst mit einem Fehler, der nicht sagt, woran es lag. Diese
  // Reihenfolge macht aus "registration failed" ein "die Datei fehlt".
  if (!(await associationReachable(host))) {
    return NextResponse.json(
      {
        error: "association_unreachable",
        detail: `https://${host}/.well-known/apple-developer-merchantid-domain-association liefert nicht den erwarteten Inhalt. Solange das so ist, kann Stripe die Domain nicht bestätigen.`,
      },
      { status: 409 },
    );
  }

  try {
    const created = await stripe().applePayDomains.create({ domain_name: host });
    console.info(`[apple-pay] Domain registriert: ${host} (${created.id})`);
    return NextResponse.json({
      ok: true,
      host,
      id: created.id,
      mode: modeOf(process.env.STRIPE_SECRET_KEY ?? ""),
      detail: `${host} ist jetzt für Apple Pay registriert. Auf einem Apple-Gerät mit hinterlegter Karte erscheint der Knopf im Checkout.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Eine bereits angemeldete Domain ist kein Fehlschlag, sondern das Ziel.
    if (/already/i.test(message)) {
      return NextResponse.json({ ok: true, host, detail: "War bereits registriert." });
    }
    console.error("[apple-pay] Registrierung fehlgeschlagen:", err);
    return NextResponse.json({ error: "stripe_error", detail: message }, { status: 502 });
  }
}
