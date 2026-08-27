// Der Widerruf: die Erklärung an uns, und die Eingangsbestätigung an den Kunden.
//
// WARUM DIE BESTÄTIGUNG NICHT OPTIONAL IST
//
// §356 Abs. 1 Satz 2 BGB: bietet der Unternehmer ein Online-Formular für den
// Widerruf an, muss er dem Verbraucher den Zugang der Erklärung UNVERZÜGLICH
// auf einem dauerhaften Datenträger bestätigen. Ein grüner Haken auf der
// Seite ist kein dauerhafter Datenträger — er ist weg, sobald der Tab zu
// ist, und der Kunde hat nichts in der Hand, um den Zugang zu beweisen.
//
// Wer also ein Formular anbietet, schuldet diese Mail. Wer sie nicht liefert,
// hat sich mit dem Formular eine Pflicht eingehandelt und sie verletzt — das
// ist schlechter als gar kein Formular.
//
// DIE ERKLÄRUNG DARF NICHT VERLOREN GEHEN
//
// Anders als bei einer Support-Anfrage steht hier eine Frist im Raum. Wenn
// der Versand an uns scheitert, meldet die Route das ausdrücklich zurück,
// und die Oberfläche nennt dem Kunden Postanschrift und E-Mail als Weg, der
// nicht von unserer Technik abhängt. Ein stiller Fehlschlag wäre hier der
// teuerste Bug im ganzen Projekt.

import { Resend } from "resend";
import { BRAND } from "@/lib/theme";
import { absolute } from "@/lib/seo";
import { CONTACT_EMAIL, addressLines, operatorLine } from "@/lib/legal";

const FROM = () =>
  process.env.SUPPORT_FROM_EMAIL ??
  process.env.AUTH_FROM_EMAIL ??
  "Malook <onboarding@resend.dev>";

const bare = (value: string) => (value.match(/<([^>]+)>/)?.[1] ?? value).trim();

/** Dieselbe Leiter wie beim Support — ein Postfach, nicht zwei Orte zum Suchen. */
function operatorInbox(): string | null {
  for (const candidate of [
    process.env.WITHDRAWAL_TO_EMAIL,
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

export interface WithdrawalDeclaration {
  name: string;
  email: string;
  /** Bestellnummer bzw. Zahlungsreferenz, falls der Kunde sie zur Hand hat. */
  orderRef: string;
  /** Kaufdatum, wie der Kunde es angibt. Freitext, absichtlich nicht validiert. */
  orderedAt: string;
  /** Anschrift — das Musterformular fragt danach, Pflicht ist sie nicht. */
  address: string;
  /** Optionale Begründung. Ein Widerruf braucht keine. */
  reason: string;
  /** Angemeldete Adresse aus der Sitzung, wenn vorhanden. */
  sessionEmail: string | null;
}

export type WithdrawalResult =
  | { ok: true; receiptSent: boolean }
  | { ok: false; reason: "unconfigured" | "failed" };

const stamp = () =>
  new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

function operatorMail(d: WithdrawalDeclaration, received: string) {
  const proven =
    d.sessionEmail && d.sessionEmail === d.email.toLowerCase()
      ? "angemeldet, Adresse bestätigt"
      : d.sessionEmail
        ? `angemeldet als ${d.sessionEmail}`
        : "nicht angemeldet";

  const rows: [string, string][] = [
    ["Name", d.name],
    ["E-Mail", d.email],
    ["Status", proven],
    ["Bestellnummer", d.orderRef || "— nicht angegeben —"],
    ["Kaufdatum", d.orderedAt || "— nicht angegeben —"],
    ["Anschrift", d.address || "— nicht angegeben —"],
    ["Eingang", received],
  ];

  return {
    subject: `[WIDERRUF] ${d.name} — ${d.orderRef || "ohne Bestellnummer"}`,
    text: [
      "WIDERRUF EINER BESTELLUNG",
      "",
      ...rows.map(([k, v]) => `${k.padEnd(15)}${v}`),
      "",
      "Begründung (freiwillig):",
      d.reason || "— keine —",
      "",
      "-- ",
      "Frist: die Rückzahlung ist binnen 14 Tagen ab diesem Eingang fällig",
      "(§357 Abs. 1 BGB). Antwort auf diese Mail geht direkt an den Kunden.",
    ].join("\n"),
    html: `<!doctype html><html><body style="margin:0;background:${BRAND.canvas};font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:${BRAND.inkSecondary}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.surface};border:1px solid #27272a;border-radius:16px;padding:28px">
      <tr><td style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#f5b544;padding-bottom:18px">Malook · Widerruf</td></tr>
      <tr><td style="font-size:18px;font-weight:600;color:${BRAND.ink};padding-bottom:18px">Ein Kunde hat widerrufen</td></tr>
      <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rows
          .map(
            ([k, v]) => `<tr>
          <td style="padding:7px 0;font-size:12px;color:${BRAND.inkTertiary};width:120px;vertical-align:top">${esc(k)}</td>
          <td style="padding:7px 0;font-size:14px;color:${BRAND.ink}">${esc(v)}</td>
        </tr>`,
          )
          .join("")}
      </table></td></tr>
      ${
        d.reason
          ? `<tr><td style="padding-top:18px">
        <div style="padding:14px 16px;background:${BRAND.canvas};border:1px solid #27272a;border-radius:12px;font-size:13px;line-height:1.65;color:${BRAND.ink};white-space:pre-wrap">${esc(d.reason)}</div>
      </td></tr>`
          : ""
      }
      <tr><td style="padding-top:20px;font-size:12px;line-height:1.6;color:${BRAND.inkTertiary}">
        Die Rückzahlung ist binnen 14 Tagen ab diesem Eingang fällig (§357 Abs. 1 BGB), über dasselbe Zahlungsmittel. Antwort auf diese Mail geht direkt an ${esc(d.email)}.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  };
}

function customerMail(d: WithdrawalDeclaration, received: string) {
  const lines = [
    ["Name", d.name],
    ["E-Mail", d.email],
    ["Bestellnummer", d.orderRef || "—"],
    ["Kaufdatum", d.orderedAt || "—"],
    ["Eingang bei uns", received],
  ] as [string, string][];

  return {
    subject: "Wir haben deinen Widerruf erhalten",
    text: [
      "Eingangsbestätigung deines Widerrufs",
      "",
      "Hiermit bestätigen wir dir den Zugang deiner Widerrufserklärung. Diese",
      "E-Mail ist deine Bestätigung auf einem dauerhaften Datenträger — heb sie auf.",
      "",
      ...lines.map(([k, v]) => `${k}: ${v}`),
      "",
      "Wie es weitergeht: wir erstatten dir den vollen Betrag binnen 14 Tagen",
      "ab diesem Eingang, über dasselbe Zahlungsmittel, mit dem du bezahlt hast.",
      "Kosten entstehen dir dadurch keine. Die gekauften Inhalte werden mit der",
      "Erstattung wieder gesperrt.",
      "",
      `Widerrufsbelehrung: ${absolute("/withdrawal")}`,
      `AGB: ${absolute("/terms")}`,
      "",
      operatorLine(),
      ...addressLines(),
      CONTACT_EMAIL,
    ].join("\n"),
    html: `<!doctype html><html><body style="margin:0;background:${BRAND.canvas};font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:${BRAND.inkSecondary}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.surface};border:1px solid #27272a;border-radius:16px;padding:28px">
      <tr><td style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.accent};padding-bottom:18px">Malook</td></tr>
      <tr><td style="font-size:20px;font-weight:600;color:${BRAND.ink};padding-bottom:12px">Wir haben deinen Widerruf erhalten</td></tr>
      <tr><td style="font-size:14px;line-height:1.65;padding-bottom:22px">Hiermit bestätigen wir dir den Zugang deiner Widerrufserklärung. Diese E-Mail ist deine Bestätigung auf einem dauerhaften Datenträger — heb sie auf.</td></tr>
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};border:1px solid #27272a;border-radius:12px;padding:16px 18px">
          ${lines
            .map(
              ([k, v]) => `<tr>
            <td style="padding:6px 0;font-size:13px;color:${BRAND.inkTertiary}">${esc(k)}</td>
            <td align="right" style="padding:6px 0;font-size:13px;color:${BRAND.ink}">${esc(v)}</td>
          </tr>`,
            )
            .join("")}
        </table>
      </td></tr>
      <tr><td style="padding-top:22px;font-size:13px;line-height:1.7">
        <strong style="color:${BRAND.ink}">Wie es weitergeht</strong><br>
        Wir erstatten dir den vollen Betrag binnen 14 Tagen ab diesem Eingang, über dasselbe Zahlungsmittel, mit dem du bezahlt hast. Kosten entstehen dir dadurch keine. Die gekauften Inhalte werden mit der Erstattung wieder gesperrt.
      </td></tr>
      <tr><td style="padding-top:20px;font-size:12px;line-height:1.7;color:${BRAND.inkTertiary}">
        ${esc(operatorLine())}<br>${addressLines().map(esc).join("<br>")}<br>
        <a href="mailto:${esc(CONTACT_EMAIL)}" style="color:${BRAND.accent};text-decoration:none">${esc(CONTACT_EMAIL)}</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  };
}

/**
 * Erst uns, dann den Kunden.
 *
 * DIE REIHENFOLGE IST DIE ENTSCHEIDUNG. Scheitert die Zustellung an uns, ist
 * der Widerruf nicht angekommen — dann darf der Kunde keine
 * Eingangsbestätigung bekommen, die ihm das Gegenteil sagt, und die Route
 * meldet den Fehlschlag, damit die Oberfläche ihm den Postweg nennen kann.
 *
 * Scheitert danach nur die Bestätigung, ist der Widerruf trotzdem bei uns.
 * Das wird als `receiptSent: false` gemeldet und nicht als Fehler: der
 * Kunde hat seine Erklärung wirksam abgegeben, und ihn das noch einmal
 * schicken zu lassen wäre falsch.
 */
export async function sendWithdrawal(
  d: WithdrawalDeclaration,
): Promise<WithdrawalResult> {
  const key = process.env.RESEND_API_KEY;
  const inbox = operatorInbox();

  if (!key || !inbox) {
    console.error(
      `[withdrawal] ${!key ? "RESEND_API_KEY" : "kein Empfänger"} fehlt — Widerruf von ${d.email} NICHT zugestellt`,
    );
    return { ok: false, reason: "unconfigured" };
  }

  const resend = new Resend(key);
  const received = stamp();

  try {
    const toUs = operatorMail(d, received);
    const res = await resend.emails.send({
      from: FROM(),
      to: inbox,
      replyTo: d.email,
      subject: toUs.subject,
      text: toUs.text,
      html: toUs.html,
    });
    if (res.error) {
      console.error("[withdrawal] Resend lehnte die Widerrufsmeldung ab:", res.error);
      return { ok: false, reason: "failed" };
    }
  } catch (err) {
    console.error("[withdrawal] Zustellung an den Betreiber warf:", err);
    return { ok: false, reason: "failed" };
  }

  let receiptSent = false;
  try {
    const toThem = customerMail(d, received);
    const res = await resend.emails.send({
      from: FROM(),
      to: d.email,
      replyTo: CONTACT_EMAIL,
      subject: toThem.subject,
      text: toThem.text,
      html: toThem.html,
    });
    receiptSent = !res.error;
    if (res.error) {
      console.error("[withdrawal] Eingangsbestätigung abgelehnt:", res.error);
    }
  } catch (err) {
    console.error("[withdrawal] Eingangsbestätigung warf:", err);
  }

  return { ok: true, receiptSent };
}
