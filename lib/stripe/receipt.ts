// Die Kaufbestätigung an den Kunden — und die Verkaufsmeldung an uns.
//
// WARUM ES DIESE DATEI GEBEN MUSS
//
// Bis hierher verschickte das Projekt genau drei Sorten Mail: Anmeldecodes,
// Partner-Nachrichten und Support-Tickets. Beim Kauf ging keine raus. Der
// Kunde zahlte, die Freischaltung erschien im Browser, und danach hatte er
// nichts in der Hand — kein Beleg, keine Adresse, an die er sich wenden
// könnte, nichts zum Wiederfinden. Die Oberfläche versprach ihm sogar einen
// ("Your email is used to sign you in and send your receipt"), und niemand
// löste das ein.
//
// Das ist nicht nur unhöflich, es ist zwingend:
//
//   §312f Abs. 2 BGB — bei einem Fernabsatzvertrag muss der Unternehmer dem
//   Verbraucher eine Bestätigung des Vertrags auf einem DAUERHAFTEN
//   DATENTRÄGER zur Verfügung stellen. Eine Bildschirmanzeige, die beim
//   Schließen des Tabs verschwindet, ist keiner. Eine E-Mail ist der
//   übliche Weg.
//
//   §356 Abs. 5 Nr. 2 BGB — bei digitalen Inhalten erlischt das
//   Widerrufsrecht nur, wenn der Unternehmer dem Verbraucher die
//   Zustimmung zum sofortigen Beginn UND die Kenntnisnahme des
//   Rechtsverlusts BESTÄTIGT hat. Die beiden Haken im Checkout sind die
//   Erklärungen des Kunden; diese Mail ist unsere Bestätigung. Ohne sie
//   fehlt das dritte Stück, und der Kauf bleibt vierzehn Tage widerrufbar.
//
// NIEMALS WERFEN. Beide Absender werden aus dem Webhook und aus
// /api/stripe/confirm heraus aufgerufen. Eine Ausnahme dort würde mit 500
// beantwortet, Stripe würde erneut zustellen, und die Freischaltung liefe
// ein zweites Mal — wegen einer Mail. Alles hier fängt seine eigenen Fehler.
//
// GENAU EINMAL. Webhook und Confirm-Route wetteifern absichtlich darum, wer
// zuerst freischaltet; beide würden also auch mailen. Der Marker im
// Entitlement-Store entscheidet das Rennen, mit demselben Mechanismus, der
// schon Stripes Wiederholungen abfängt.

import { Resend } from "resend";
import { BRAND } from "@/lib/theme";
import { absolute } from "@/lib/seo";
import { CONTACT_EMAIL, addressLines, operatorLine } from "@/lib/legal";
import { entitlements } from "@/lib/stripe/entitlements";
import type { PlanId } from "@/lib/pricing";
import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";

const PLAN_NAMES = { de, en, es, fr } as const;
type Loc = keyof typeof PLAN_NAMES;

const isLoc = (v: string): v is Loc => v in PLAN_NAMES;

/** Deutsch, wenn nichts anderes bekannt ist — der Heimatmarkt dieser Domain. */
function localeOf(raw: string | null | undefined): Loc {
  const base = (raw ?? "").toLowerCase().split("-")[0];
  return isLoc(base) ? base : "de";
}

const COPY = {
  de: {
    subject: "Deine Bestellung bei Malook",
    heading: "Vielen Dank für deinen Kauf",
    intro:
      "Deine Bestellung ist eingegangen und deine Analyse ist freigeschaltet. Diese E-Mail ist zugleich deine Vertragsbestätigung — heb sie auf.",
    item: "Paket",
    gross: "Gesamt",
    net: "Netto",
    vat: "zzgl. 19 % USt.",
    date: "Datum",
    ref: "Bestellnummer",
    sellerTitle: "Verkäufer",
    withdrawalTitle: "Zu deinem Widerrufsrecht",
    withdrawal:
      "Du hast im Bezahlvorgang ausdrücklich verlangt, dass wir mit der Ausführung vor Ablauf der Widerrufsfrist beginnen, und bestätigt, dass du dadurch mit vollständiger Vertragserfüllung dein Widerrufsrecht verlierst. Beides bestätigen wir dir hiermit. Die Inhalte standen unmittelbar nach der Zahlung bereit.",
    linksTitle: "Unterlagen",
    terms: "AGB",
    withdrawalLink: "Widerrufsbelehrung",
    privacy: "Datenschutz",
    imprint: "Impressum",
    help: "Fragen? Antworte einfach auf diese E-Mail.",
  },
  en: {
    subject: "Your Malook order",
    heading: "Thank you for your purchase",
    intro:
      "We received your order and your analysis is unlocked. This email is also your contract confirmation — please keep it.",
    item: "Package",
    gross: "Total",
    net: "Net",
    vat: "plus 19% VAT",
    date: "Date",
    ref: "Order number",
    sellerTitle: "Seller",
    withdrawalTitle: "About your right of withdrawal",
    withdrawal:
      "During checkout you expressly requested that we begin performance before the withdrawal period ends, and confirmed that you thereby lose your right of withdrawal upon full performance. We hereby confirm both. The content was available immediately after payment.",
    linksTitle: "Documents",
    terms: "Terms",
    withdrawalLink: "Withdrawal policy",
    privacy: "Privacy",
    imprint: "Imprint",
    help: "Questions? Just reply to this email.",
  },
  es: {
    subject: "Tu pedido en Malook",
    heading: "Gracias por tu compra",
    intro:
      "Hemos recibido tu pedido y tu análisis está desbloqueado. Este correo es también tu confirmación de contrato — consérvalo.",
    item: "Paquete",
    gross: "Total",
    net: "Base imponible",
    vat: "más 19 % de IVA",
    date: "Fecha",
    ref: "Número de pedido",
    sellerTitle: "Vendedor",
    withdrawalTitle: "Sobre tu derecho de desistimiento",
    withdrawal:
      "Durante el pago solicitaste expresamente que comenzáramos la ejecución antes de que finalizara el plazo de desistimiento y confirmaste que, con ello, pierdes tu derecho de desistimiento una vez ejecutado el contrato. Confirmamos ambas declaraciones. El contenido estuvo disponible inmediatamente tras el pago.",
    linksTitle: "Documentos",
    terms: "Condiciones",
    withdrawalLink: "Desistimiento",
    privacy: "Privacidad",
    imprint: "Aviso legal",
    help: "¿Preguntas? Responde a este correo.",
  },
  fr: {
    subject: "Ta commande chez Malook",
    heading: "Merci pour ton achat",
    intro:
      "Nous avons bien reçu ta commande et ton analyse est débloquée. Cet e-mail constitue également ta confirmation de contrat — conserve-le.",
    item: "Formule",
    gross: "Total",
    net: "Montant HT",
    vat: "plus 19 % de TVA",
    date: "Date",
    ref: "Numéro de commande",
    sellerTitle: "Vendeur",
    withdrawalTitle: "À propos de ton droit de rétractation",
    withdrawal:
      "Lors du paiement, tu as expressément demandé que nous commencions l'exécution avant la fin du délai de rétractation et confirmé que tu perds ainsi ton droit de rétractation une fois le contrat pleinement exécuté. Nous te confirmons ces deux déclarations. Le contenu a été accessible immédiatement après le paiement.",
    linksTitle: "Documents",
    terms: "CGV",
    withdrawalLink: "Rétractation",
    privacy: "Confidentialité",
    imprint: "Mentions légales",
    help: "Des questions ? Réponds simplement à cet e-mail.",
  },
} as const;

/** Ein verifizierter Absender ist Pflicht; resend.dev ist die Notbremse. */
const FROM = () =>
  process.env.PURCHASE_FROM_EMAIL ??
  process.env.AUTH_FROM_EMAIL ??
  "Malook <onboarding@resend.dev>";

/** "Malook <team@example.com>" → "team@example.com". */
const bare = (value: string) => (value.match(/<([^>]+)>/)?.[1] ?? value).trim();

/** Wohin die Verkaufsmeldung geht. Dieselbe Leiter wie beim Support. */
function operatorInbox(): string | null {
  for (const candidate of [
    process.env.SALES_TO_EMAIL,
    process.env.SUPPORT_TO_EMAIL,
    process.env.ADMIN_ALERT_EMAIL,
    process.env.AUTH_FROM_EMAIL,
  ]) {
    const trimmed = candidate?.trim();
    if (trimmed && bare(trimmed).includes("@")) return bare(trimmed);
  }
  return null;
}

function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}

function money(minor: number, currency: string, loc: Loc): string {
  return new Intl.NumberFormat(
    { de: "de-DE", en: "en-US", es: "es-ES", fr: "fr-FR" }[loc],
    { style: "currency", currency: currency.toUpperCase() },
  ).format(minor / 100);
}

export interface PurchaseReceipt {
  email: string;
  plan: PlanId;
  /** Was Stripe tatsächlich belastet hat, in Cent. */
  amountMinor: number | null;
  currency: string | null;
  paymentIntentId: string;
  /** Locale aus den Intent-Metadaten, wenn vorhanden. */
  locale?: string | null;
}

function template(r: PurchaseReceipt, loc: Loc) {
  const c = COPY[loc];
  const planName = PLAN_NAMES[loc].plans[r.plan].name;
  const currency = (r.currency ?? "eur").toLowerCase();
  const amount = r.amountMinor ?? 0;

  // Aus dem TATSÄCHLICH belasteten Betrag gerechnet, nicht aus der
  // Preistabelle. Wich der Betrag je ab, wäre der Beleg sonst über etwas
  // ausgestellt, das so nie abgebucht wurde.
  const isEur = currency === "eur";
  const netMinor = isEur ? Math.round(amount / 1.19) : amount;
  const vatMinor = amount - netMinor;

  const date = new Date().toLocaleDateString(
    { de: "de-DE", en: "en-US", es: "es-ES", fr: "fr-FR" }[loc],
    { year: "numeric", month: "long", day: "numeric" },
  );

  const rows: [string, string][] = [
    [c.item, planName],
    ...(isEur
      ? ([
          [c.net, money(netMinor, currency, loc)],
          [c.vat, money(vatMinor, currency, loc)],
        ] as [string, string][])
      : []),
    [c.gross, money(amount, currency, loc)],
    [c.date, date],
    [c.ref, r.paymentIntentId],
  ];

  const text = [
    c.heading,
    "",
    c.intro,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    c.sellerTitle,
    operatorLine(),
    ...addressLines(),
    CONTACT_EMAIL,
    "",
    c.withdrawalTitle,
    c.withdrawal,
    "",
    `${c.terms}: ${absolute("/terms")}`,
    `${c.withdrawalLink}: ${absolute("/withdrawal")}`,
    `${c.privacy}: ${absolute("/privacy")}`,
    `${c.imprint}: ${absolute("/impressum")}`,
    "",
    c.help,
  ].join("\n");

  const link = (label: string, path: string) =>
    `<a href="${absolute(path)}" style="color:${BRAND.accent};text-decoration:none">${esc(label)}</a>`;

  const html = `<!doctype html><html><body style="margin:0;background:${BRAND.canvas};font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:${BRAND.inkSecondary}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.surface};border:1px solid #27272a;border-radius:16px;padding:28px">
        <tr><td style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.accent};padding-bottom:18px">Malook</td></tr>
        <tr><td style="font-size:20px;font-weight:600;color:${BRAND.ink};padding-bottom:12px">${esc(c.heading)}</td></tr>
        <tr><td style="font-size:14px;line-height:1.65;padding-bottom:22px">${esc(c.intro)}</td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};border:1px solid #27272a;border-radius:12px;padding:16px 18px">
            ${rows
              .map(
                ([k, v], i) => `
            <tr>
              <td style="padding:6px 0;font-size:13px;color:${BRAND.inkTertiary}">${esc(k)}</td>
              <td align="right" style="padding:6px 0;font-size:13px;color:${i === rows.length - 4 || i === rows.length - 1 ? BRAND.ink : BRAND.inkSecondary}">${esc(v)}</td>
            </tr>`,
              )
              .join("")}
          </table>
        </td></tr>
        <tr><td style="padding-top:22px;font-size:12px;line-height:1.7;color:${BRAND.inkTertiary}">
          <strong style="color:${BRAND.inkSecondary}">${esc(c.sellerTitle)}</strong><br>
          ${esc(operatorLine())}<br>
          ${addressLines().map(esc).join("<br>")}<br>
          <a href="mailto:${esc(CONTACT_EMAIL)}" style="color:${BRAND.accent};text-decoration:none">${esc(CONTACT_EMAIL)}</a>
        </td></tr>
        <tr><td style="padding-top:20px;font-size:12px;line-height:1.7;color:${BRAND.inkTertiary}">
          <strong style="color:${BRAND.inkSecondary}">${esc(c.withdrawalTitle)}</strong><br>
          ${esc(c.withdrawal)}
        </td></tr>
        <tr><td style="padding-top:20px;font-size:12px;color:${BRAND.inkTertiary}">
          ${link(c.terms, "/terms")} &nbsp;·&nbsp; ${link(c.withdrawalLink, "/withdrawal")} &nbsp;·&nbsp; ${link(c.privacy, "/privacy")} &nbsp;·&nbsp; ${link(c.imprint, "/impressum")}
        </td></tr>
        <tr><td style="padding-top:18px;font-size:12px;color:${BRAND.inkTertiary}">${esc(c.help)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: `${c.subject} · ${planName}`, text, html };
}

/**
 * Bestätigung an den Kunden, Meldung an uns — genau einmal pro Zahlung.
 *
 * Der Rückgabewert ist reine Diagnose; kein Aufrufer trifft daraufhin eine
 * Entscheidung, und keiner darf es, weil eine nicht zugestellte Mail eine
 * bezahlte Freischaltung nicht rückgängig machen soll.
 */
export async function sendPurchaseReceipt(
  r: PurchaseReceipt,
): Promise<{ sent: boolean; reason?: string }> {
  const marker = `receipt:${r.paymentIntentId}`;

  try {
    if (await entitlements.hasProcessed(marker)) {
      return { sent: false, reason: "already_sent" };
    }
  } catch {
    // Speicher nicht erreichbar. Lieber eine Bestätigung doppelt als eine
    // Bestellung ohne Beleg — §312f verlangt sie, ein Duplikat ist nur
    // lästig.
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("[receipt] RESEND_API_KEY fehlt, keine Kaufbestätigung versendet");
    return { sent: false, reason: "unconfigured" };
  }

  const loc = localeOf(r.locale);
  const { subject, text, html } = template(r, loc);
  const resend = new Resend(key);

  let sent = false;
  try {
    const res = await resend.emails.send({
      from: FROM(),
      to: r.email,
      replyTo: CONTACT_EMAIL,
      subject,
      text,
      html,
    });
    if (res.error) {
      console.error("[receipt] Resend lehnte die Kaufbestätigung ab:", res.error);
    } else {
      sent = true;
      // Erst nach der Zustellung markieren: eine abgelehnte Mail darf den
      // zweiten Versuch aus der anderen Freischaltungsroute nicht sperren.
      try {
        await entitlements.markProcessed(marker);
      } catch {
        /* der Beleg ist raus; der Marker ist nur Komfort */
      }
    }
  } catch (err) {
    console.error("[receipt] Versand der Kaufbestätigung warf:", err);
  }

  // Die Verkaufsmeldung an uns. Bewusst danach und bewusst getrennt: sie ist
  // Betriebsinformation, der Beleg ist Pflicht, und ein kaputtes
  // Betreiberpostfach darf den Beleg nicht mitreißen.
  const inbox = operatorInbox();
  if (inbox) {
    const amount =
      r.amountMinor !== null
        ? money(r.amountMinor, r.currency ?? "eur", "de")
        : "unbekannt";
    try {
      await resend.emails.send({
        from: FROM(),
        to: inbox,
        replyTo: r.email,
        subject: `[Verkauf] ${PLAN_NAMES.de.plans[r.plan].name} · ${amount}`,
        text: [
          `Paket:    ${PLAN_NAMES.de.plans[r.plan].name}`,
          `Betrag:   ${amount}`,
          `Kunde:    ${r.email}`,
          `Sprache:  ${loc}`,
          `Zahlung:  ${r.paymentIntentId}`,
          "",
          "Antwort auf diese Mail geht direkt an den Kunden.",
        ].join("\n"),
      });
    } catch (err) {
      console.error("[receipt] Verkaufsmeldung an den Betreiber warf:", err);
    }
  } else {
    console.warn(
      "[receipt] kein Betreiberpostfach (SALES_TO_EMAIL / SUPPORT_TO_EMAIL / ADMIN_ALERT_EMAIL) — Verkauf nicht gemeldet",
    );
  }

  return sent ? { sent: true } : { sent: false, reason: "failed" };
}
