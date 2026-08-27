import { APPLE_PAY_DOMAIN_ASSOCIATION } from "@/lib/stripe/apple-pay-association";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * Die Datei, an der Apple Pay eine Domain wiedererkennt.
 *
 * Erreichbar ist sie unter dem Pfad, den Apple vorschreibt:
 *
 *   /.well-known/apple-developer-merchantid-domain-association
 *
 * Dorthin kommt sie ueber eine Umschreibung in next.config.mjs. Der Umweg
 * ist noetig, weil ein Ordner, dessen Name mit einem Punkt beginnt, vom
 * Router in app/ nicht als Route gelesen wird und in public/ je nach
 * Auslieferung stillschweigend verschluckt werden kann. Eine Umschreibung
 * auf eine gewoehnliche Route haengt von keiner dieser Feinheiten ab.
 *
 * OEFFENTLICH, UND DAS IST RICHTIG SO. Der Inhalt ist kein Geheimnis — er
 * ist Stripes Zuordnung, fuer jeden Stripe-Haendler derselbe, und Apple wie
 * Stripe muessen ihn ungehindert abrufen koennen. Waere er geschuetzt,
 * schluege die Registrierung fehl.
 */
export function GET() {
  // Der Umweg ueber die Umgebungsvariable existiert fuer den Tag, an dem
  // Stripe die Datei austauscht: dann genuegt eine Variable statt eines
  // Deploys, und Apple Pay faellt nicht aus, bis jemand den Quelltext
  // nachzieht.
  const body =
    process.env.APPLE_PAY_DOMAIN_ASSOCIATION?.trim() ||
    APPLE_PAY_DOMAIN_ASSOCIATION;

  return new Response(body, {
    status: 200,
    headers: {
      // Apple und Stripe lesen die rohen Bytes; der Typ ist ihnen gleich.
      // text/plain, weil ein Mensch, der den Pfad im Browser aufruft, sonst
      // einen Download bekommt statt einer Antwort auf die Frage, ob die
      // Datei ueberhaupt ausgeliefert wird.
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
