// Every mail the affiliate programme sends, in one place.
//
// Modelled on lib/auth/email.ts: one Resend client, AUTH_FROM_EMAIL as the
// sender, a text part next to the HTML part, brand colours from lib/theme.
// Two rules carry over unchanged and one is added:
//
//   * NOTHING HERE EVER THROWS. Every function returns a SendResult. These
//     calls sit in the money path — a commission is booked inside the Stripe
//     webhook, a payout is decided inside an admin route — and a mail
//     provider having a bad minute must never roll back a booking or make
//     Stripe redeliver an event.
//   * WITHOUT RESEND_API_KEY the mail is printed to the console in
//     development and reported as `unconfigured` in production. A silent
//     no-op looks exactly like a lost mail and is miserable to debug.
//   * NO PERSONAL DATA IN THE BODY. No full IBAN, no customer address, no
//     customer e-mail. The admin payout mail carries the masked account
//     number and a link; the full IBAN is revealed in the admin UI, behind a
//     click that gets logged. A mailbox is the one place this data must not
//     end up, because it is copied to a phone, a laptop and a provider's
//     servers the moment it is delivered.
//
// Partner mails are written in the partner's own language. Each mail keeps
// its four translations in a single table so a missing wording is visible as
// a type error rather than as an English sentence in a German inbox.

import { Resend } from "resend";
import { BRAND } from "@/lib/theme";
// Only the canonical origin — lib/seo.ts also exports a BRAND (the name
// string), which is not the palette this file means by that word.
import { SITE_URL } from "@/lib/seo";
import type { Locale } from "@/lib/i18n/types";
import type { PlanId } from "@/lib/pricing";
import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";

const FROM = process.env.AUTH_FROM_EMAIL ?? "FaceScan <onboarding@resend.dev>";

export type SendResult =
  | { ok: true; devFallback?: boolean }
  | { ok: false; reason: "unconfigured" | "failed" };

/* -------------------------------------------------------------------------- */
/* Origin                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The absolute origin every link in these mails is built from.
 *
 * A mail is read outside the browser that produced it, so a relative path is
 * worthless here — every link has to be absolute. NEXT_PUBLIC_SITE_URL is the
 * deliberate answer; VERCEL_URL is the automatic one on preview deployments
 * (it never carries a scheme, so one is added); localhost is the development
 * floor. Always without a trailing slash, so callers can append "/partner"
 * without producing a double slash.
 */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // In production the CANONICAL domain wins over the deployment URL, and not
  // for looks: /r/<code> sets the referral cookie on whatever host served it.
  // A link on facescan-xyz.vercel.app would set the cookie there, the visitor
  // would then buy on www.malookai.com, and the cookie would not travel — the
  // partner loses the sale they made. Vercel's own URL is only right for a
  // preview deployment, where it IS the site.
  if (process.env.VERCEL_ENV === "production") return SITE_URL.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withScheme = /^https?:\/\//i.test(vercel) ? vercel : `https://${vercel}`;
    return withScheme.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-GB",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

const DICTS: Record<Locale, typeof de> = { de, en, es, fr };

/**
 * Payouts happen in euro, whatever currency the shop quoted.
 *
 * lib/pricing.ts prices the English store in USD, but the commission is a
 * SEPA transfer from a German bank account — so the amount a partner reads
 * here has to be the amount that will land, in the currency it will land in.
 * Only the number FORMAT follows the reader's locale.
 */
function money(locale: Locale, cents: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function percent(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function day(locale: Locale, at: number): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(at));
}

function count(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/**
 * The plan name comes out of the shop dictionaries rather than a private
 * table here: the mail says "Analyse Pro" because that is what the checkout
 * said, and a second copy of those names is a copy that goes stale.
 */
function planName(locale: Locale, plan: PlanId): string {
  return DICTS[locale].plans[plan]?.name ?? plan;
}

/** German is the fallback everywhere in this app — including for a locale we cannot read. */
function lang(locale: Locale | undefined): Locale {
  return locale && locale in INTL_LOCALE ? locale : "de";
}

/** A value that never made it through the form still has to render as something. */
function orDash(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "—";
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What a mail is made of. Every template fills this shape and the renderer
 * turns it into both parts — so the text alternative can never drift away
 * from the HTML, which is what happens when both are written by hand.
 */
interface MailCopy {
  subject: string;
  title: string;
  intro: string;
  /** The one number the mail is about, set in large type. */
  hero?: { label: string; value: string };
  rows?: Array<[string, string]>;
  cta?: { label: string; href: string };
  note?: string;
}

const HAIRLINE = "#27272a";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * One shell for all of them: brand line, card, footer.
 *
 * Tables and inline styles rather than flexbox and a stylesheet, because
 * Outlook still renders mail with Word's layout engine — a div grid collapses
 * into a single column there and the amount ends up under its own label.
 */
function renderHtml(locale: Locale, copy: MailCopy, footer: string): string {
  const parts: string[] = [];

  parts.push(
    `<tr><td style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.accent};padding-bottom:20px">FaceScan</td></tr>`,
    `<tr><td style="font-size:19px;font-weight:600;color:${BRAND.ink};padding-bottom:8px">${esc(copy.title)}</td></tr>`,
    `<tr><td style="font-size:14px;line-height:1.6;color:${BRAND.inkSecondary};padding-bottom:24px">${esc(copy.intro)}</td></tr>`,
  );

  if (copy.hero) {
    parts.push(
      `<tr><td align="center" style="padding:20px 16px;background:${BRAND.canvas};border:1px solid ${HAIRLINE};border-radius:12px">` +
        `<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.inkTertiary};padding-bottom:8px">${esc(copy.hero.label)}</div>` +
        `<div style="font-size:30px;font-weight:600;color:${BRAND.accent};line-height:1.2">${esc(copy.hero.value)}</div>` +
        `</td></tr>`,
    );
  }

  if (copy.rows?.length) {
    const cells = copy.rows
      .map(
        ([label, value]) =>
          `<tr>` +
          `<td style="font-size:13px;line-height:1.5;color:${BRAND.inkTertiary};padding:10px 12px 10px 0;border-bottom:1px solid ${HAIRLINE}">${esc(label)}</td>` +
          `<td align="right" style="font-size:13px;line-height:1.5;font-weight:600;color:${BRAND.ink};padding:10px 0;border-bottom:1px solid ${HAIRLINE}">${esc(value)}</td>` +
          `</tr>`,
      )
      .join("");
    parts.push(
      `<tr><td style="padding-top:24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cells}</table></td></tr>`,
    );
  }

  if (copy.cta) {
    parts.push(
      `<tr><td style="padding-top:26px">` +
        `<table role="presentation" cellpadding="0" cellspacing="0"><tr>` +
        `<td style="background:${BRAND.accent};border-radius:10px">` +
        `<a href="${esc(copy.cta.href)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:${BRAND.accentInk};text-decoration:none">${esc(copy.cta.label)}</a>` +
        `</td></tr></table>` +
        `</td></tr>`,
    );
  }

  if (copy.note) {
    parts.push(
      `<tr><td style="font-size:12px;line-height:1.6;color:${BRAND.inkTertiary};padding-top:24px">${esc(copy.note)}</td></tr>`,
    );
  }

  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:${BRAND.canvas};font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:${BRAND.inkSecondary}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:${BRAND.surface};border:1px solid ${HAIRLINE};border-radius:16px;padding:32px">
        ${parts.join("\n        ")}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px">
        <tr><td style="font-size:11px;line-height:1.6;color:${BRAND.inkTertiary};padding:18px 4px 0">${esc(footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderText(copy: MailCopy, footer: string): string {
  const lines: string[] = ["FaceScan", "", copy.title, "", copy.intro];

  if (copy.hero) lines.push("", `${copy.hero.label}: ${copy.hero.value}`);

  if (copy.rows?.length) {
    lines.push("");
    for (const [label, value] of copy.rows) lines.push(`${label}: ${value}`);
  }

  if (copy.cta) lines.push("", `${copy.cta.label}: ${copy.cta.href}`);
  if (copy.note) lines.push("", copy.note);

  lines.push("", "--", footer);
  return lines.join("\n");
}

const FOOTER: Record<Locale, string> = {
  de: "Du bekommst diese E-Mail, weil du am FaceScan-Partnerprogramm teilnimmst.",
  en: "You are receiving this email because you take part in the FaceScan partner programme.",
  es: "Recibes este correo porque participas en el programa de socios de FaceScan.",
  fr: "Tu reçois cet e-mail parce que tu participes au programme partenaire de FaceScan.",
};

const ADMIN_FOOTER =
  "Automatische Nachricht aus dem FaceScan-Partnerprogramm. Antworten laufen ins Leere.";

/* -------------------------------------------------------------------------- */
/* Transport                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resend wants a bare address in `to`. AUTH_FROM_EMAIL is usually written as
 * "FaceScan <team@example.com>" because it doubles as the From header, so the
 * display name is stripped before it is used as a recipient.
 */
function bareAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return (angled ? angled[1] : value).trim();
}

/**
 * Where operational mail goes. ADMIN_ALERT_EMAIL is the intended mailbox; the
 * sender address is the fallback, because a mail to yourself still arrives.
 * Neither configured means nobody would read it — say so instead of pretending.
 */
function adminRecipient(): string | null {
  const explicit = process.env.ADMIN_ALERT_EMAIL?.trim();
  if (explicit) return bareAddress(explicit);

  const from = process.env.AUTH_FROM_EMAIL?.trim();
  if (from) return bareAddress(from);

  return null;
}

async function deliver(
  to: string,
  copy: MailCopy,
  locale: Locale,
  footer: string,
  tag: string,
): Promise<SendResult> {
  try {
    const recipient = bareAddress(to);
    if (!recipient || !recipient.includes("@")) {
      console.error(`[affiliate] ${tag}: no usable recipient address`);
      return { ok: false, reason: "unconfigured" };
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) {
      if (process.env.NODE_ENV !== "production") {
        console.info(
          `[affiliate] no RESEND_API_KEY — ${tag} for ${recipient}: ${copy.subject}`,
        );
        return { ok: true, devFallback: true };
      }
      console.error(`[affiliate] ${tag}: RESEND_API_KEY missing, mail not sent`);
      return { ok: false, reason: "unconfigured" };
    }

    const res = await new Resend(key).emails.send({
      from: FROM,
      to: recipient,
      subject: copy.subject,
      text: renderText(copy, footer),
      html: renderHtml(locale, copy, footer),
    });

    if (res.error) {
      console.error(`[affiliate] ${tag}: Resend rejected the message:`, res.error);
      return { ok: false, reason: "failed" };
    }
    return { ok: true };
  } catch (err) {
    // Includes template failures, not just network ones: a booking must not
    // fall over because a number could not be formatted.
    console.error(`[affiliate] ${tag}: send threw:`, err);
    return { ok: false, reason: "failed" };
  }
}

/** Admin mail is always German — same as the admin interface itself. */
async function deliverAdmin(copy: MailCopy, tag: string): Promise<SendResult> {
  const to = adminRecipient();
  if (!to) {
    console.error(
      `[affiliate] ${tag}: neither ADMIN_ALERT_EMAIL nor AUTH_FROM_EMAIL is set, nobody was notified`,
    );
    return { ok: false, reason: "unconfigured" };
  }
  return deliver(to, copy, "de", ADMIN_FOOTER, tag);
}

/* -------------------------------------------------------------------------- */
/* 1. A referred customer bought something                                     */
/* -------------------------------------------------------------------------- */

interface EarnedVars {
  amount: string;
  plan: string;
  gross: string;
  rate: string;
  level: number;
  levelLabel: string;
  total: string;
  matures: string;
  link: string;
}

const EARNED: Record<Locale, (v: EarnedVars) => MailCopy> = {
  de: (v) => ({
    subject: `Du hast ${v.amount} verdient`,
    title: "Provision gutgeschrieben",
    intro:
      "Jemand, den du geworben hast, hat gerade gekauft. Deine Provision ist gebucht.",
    hero: { label: "Deine Provision", value: v.amount },
    rows: [
      ["Paket", v.plan],
      ["Kaufbetrag", v.gross],
      ["Dein Satz", `${v.rate} · Level ${v.level} ${v.levelLabel}`],
      ["Auszahlbar ab", v.matures],
      ["Bisher verdient", v.total],
    ],
    cta: { label: "Partner-Dashboard öffnen", href: v.link },
    note: "Provisionen reifen ein paar Tage, bevor du sie auszahlen lassen kannst — das deckt Rückgaben und Rückbuchungen ab.",
  }),
  en: (v) => ({
    subject: `You just earned ${v.amount}`,
    title: "Commission booked",
    intro: "Someone you referred just bought. Your commission is on your account.",
    hero: { label: "Your commission", value: v.amount },
    rows: [
      ["Package", v.plan],
      ["Purchase amount", v.gross],
      ["Your rate", `${v.rate} · level ${v.level} ${v.levelLabel}`],
      ["Payable from", v.matures],
      ["Earned so far", v.total],
    ],
    cta: { label: "Open partner dashboard", href: v.link },
    note: "Commissions mature for a few days before you can request a payout — that covers refunds and chargebacks.",
  }),
  es: (v) => ({
    subject: `Acabas de ganar ${v.amount}`,
    title: "Comisión registrada",
    intro:
      "Alguien a quien recomendaste acaba de comprar. Tu comisión ya está registrada.",
    hero: { label: "Tu comisión", value: v.amount },
    rows: [
      ["Paquete", v.plan],
      ["Importe de la compra", v.gross],
      ["Tu porcentaje", `${v.rate} · nivel ${v.level} ${v.levelLabel}`],
      ["Disponible desde", v.matures],
      ["Ganado hasta ahora", v.total],
    ],
    cta: { label: "Abrir el panel de socio", href: v.link },
    note: "Las comisiones maduran unos días antes de que puedas solicitar el pago: así se cubren las devoluciones y los cargos revertidos.",
  }),
  fr: (v) => ({
    subject: `Tu viens de gagner ${v.amount}`,
    title: "Commission enregistrée",
    intro:
      "Une personne que tu as parrainée vient d'acheter. Ta commission est enregistrée.",
    hero: { label: "Ta commission", value: v.amount },
    rows: [
      ["Formule", v.plan],
      ["Montant de l'achat", v.gross],
      ["Ton taux", `${v.rate} · niveau ${v.level} ${v.levelLabel}`],
      ["Versable à partir du", v.matures],
      ["Gagné jusqu'ici", v.total],
    ],
    cta: { label: "Ouvrir le tableau de bord partenaire", href: v.link },
    note: "Les commissions mûrissent quelques jours avant de pouvoir être versées : cela couvre les remboursements et les impayés.",
  }),
};

export async function sendReferralEarned(
  to: string,
  p: {
    locale: Locale;
    amountCents: number;
    plan: PlanId;
    grossCents: number;
    percent: number;
    level: number;
    levelLabel: string;
    totalEarnedCents: number;
    maturesAt: number;
    link: string;
  },
): Promise<SendResult> {
  try {
    const l = lang(p.locale);
    // The customer's address is deliberately absent from every field below:
    // the partner is told that a sale happened, not who made it.
    const copy = EARNED[l]({
      amount: money(l, p.amountCents),
      plan: planName(l, p.plan),
      gross: money(l, p.grossCents),
      rate: percent(l, p.percent),
      level: p.level,
      levelLabel: p.levelLabel,
      total: money(l, p.totalEarnedCents),
      matures: day(l, p.maturesAt),
      link: p.link,
    });
    return await deliver(to, copy, l, FOOTER[l], "referral-earned");
  } catch (err) {
    console.error("[affiliate] referral-earned: could not build the mail:", err);
    return { ok: false, reason: "failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Level up                                                                 */
/* -------------------------------------------------------------------------- */

interface LevelVars {
  level: number;
  label: string;
  rate: string;
  link: string;
}

const LEVEL_UP: Record<Locale, (v: LevelVars) => MailCopy> = {
  de: (v) => ({
    subject: `Level ${v.level} erreicht — ab jetzt ${v.rate}`,
    title: "Neues Level",
    intro:
      "Du hast genug zahlende Kunden geworben für die nächste Stufe. Der neue Satz gilt ab dem nächsten Kauf.",
    hero: { label: "Dein Level", value: `${v.level} · ${v.label}` },
    rows: [["Dein neuer Satz", v.rate]],
    cta: { label: "Partner-Dashboard öffnen", href: v.link },
    note: "Bereits gebuchte Provisionen behalten ihren alten Satz — er wird im Moment des Kaufs eingefroren.",
  }),
  en: (v) => ({
    subject: `Level ${v.level} reached — ${v.rate} from now on`,
    title: "New level",
    intro:
      "You have referred enough paying customers for the next tier. The new rate applies from the next purchase.",
    hero: { label: "Your level", value: `${v.level} · ${v.label}` },
    rows: [["Your new rate", v.rate]],
    cta: { label: "Open partner dashboard", href: v.link },
    note: "Commissions already booked keep their old rate — it is frozen at the moment of the purchase.",
  }),
  es: (v) => ({
    subject: `Nivel ${v.level} alcanzado — a partir de ahora ${v.rate}`,
    title: "Nuevo nivel",
    intro:
      "Has recomendado suficientes clientes de pago para el siguiente nivel. El nuevo porcentaje se aplica desde la próxima compra.",
    hero: { label: "Tu nivel", value: `${v.level} · ${v.label}` },
    rows: [["Tu nuevo porcentaje", v.rate]],
    cta: { label: "Abrir el panel de socio", href: v.link },
    note: "Las comisiones ya registradas mantienen su porcentaje anterior: se congela en el momento de la compra.",
  }),
  fr: (v) => ({
    subject: `Niveau ${v.level} atteint — ${v.rate} désormais`,
    title: "Nouveau niveau",
    intro:
      "Tu as parrainé assez de clients payants pour le palier suivant. Le nouveau taux s'applique dès le prochain achat.",
    hero: { label: "Ton niveau", value: `${v.level} · ${v.label}` },
    rows: [["Ton nouveau taux", v.rate]],
    cta: { label: "Ouvrir le tableau de bord partenaire", href: v.link },
    note: "Les commissions déjà enregistrées conservent leur ancien taux : il est figé au moment de l'achat.",
  }),
};

export async function sendLevelUp(
  to: string,
  p: { locale: Locale; level: number; label: string; percent: number; link: string },
): Promise<SendResult> {
  try {
    const l = lang(p.locale);
    const copy = LEVEL_UP[l]({
      level: p.level,
      label: p.label,
      rate: percent(l, p.percent),
      link: p.link,
    });
    return await deliver(to, copy, l, FOOTER[l], "level-up");
  } catch (err) {
    console.error("[affiliate] level-up: could not build the mail:", err);
    return { ok: false, reason: "failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Payout requested — partner's receipt                                     */
/* -------------------------------------------------------------------------- */

interface RequestedVars {
  amount: string;
  payoutId: string;
  holdDays: string;
  link: string;
}

const PAYOUT_REQUESTED: Record<Locale, (v: RequestedVars) => MailCopy> = {
  de: (v) => ({
    subject: `Auszahlung beantragt: ${v.amount}`,
    title: "Antrag eingegangen",
    intro: "Wir haben deinen Auszahlungsantrag erhalten.",
    hero: { label: "Beantragter Betrag", value: v.amount },
    rows: [["Antragsnummer", v.payoutId]],
    cta: { label: "Status ansehen", href: v.link },
    note: `Jeder Antrag wird von Hand geprüft; das dauert in der Regel bis zu ${v.holdDays} Tage. Du bekommst eine E-Mail, sobald das Geld unterwegs ist.`,
  }),
  en: (v) => ({
    subject: `Payout requested: ${v.amount}`,
    title: "Request received",
    intro: "We have your payout request.",
    hero: { label: "Requested amount", value: v.amount },
    rows: [["Request number", v.payoutId]],
    cta: { label: "View status", href: v.link },
    note: `Every request is reviewed by hand; that usually takes up to ${v.holdDays} days. You will get an email as soon as the money is on its way.`,
  }),
  es: (v) => ({
    subject: `Pago solicitado: ${v.amount}`,
    title: "Solicitud recibida",
    intro: "Hemos recibido tu solicitud de pago.",
    hero: { label: "Importe solicitado", value: v.amount },
    rows: [["Número de solicitud", v.payoutId]],
    cta: { label: "Ver el estado", href: v.link },
    note: `Revisamos cada solicitud a mano; suele tardar hasta ${v.holdDays} días. Te avisaremos por correo en cuanto salga el dinero.`,
  }),
  fr: (v) => ({
    subject: `Versement demandé : ${v.amount}`,
    title: "Demande reçue",
    intro: "Nous avons bien reçu ta demande de versement.",
    hero: { label: "Montant demandé", value: v.amount },
    rows: [["Numéro de demande", v.payoutId]],
    cta: { label: "Voir le statut", href: v.link },
    note: `Chaque demande est vérifiée à la main ; cela prend en général jusqu'à ${v.holdDays} jours. Tu recevras un e-mail dès que l'argent partira.`,
  }),
};

export async function sendPayoutRequestedPartner(
  to: string,
  p: {
    locale: Locale;
    amountCents: number;
    payoutId: string;
    holdDays: number;
    link: string;
  },
): Promise<SendResult> {
  try {
    const l = lang(p.locale);
    const copy = PAYOUT_REQUESTED[l]({
      amount: money(l, p.amountCents),
      payoutId: p.payoutId,
      holdDays: count(l, p.holdDays),
      link: p.link,
    });
    return await deliver(to, copy, l, FOOTER[l], "payout-requested-partner");
  } catch (err) {
    console.error(
      "[affiliate] payout-requested-partner: could not build the mail:",
      err,
    );
    return { ok: false, reason: "failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Payout requested — the operator's copy                                   */
/* -------------------------------------------------------------------------- */

export async function sendPayoutRequestedAdmin(p: {
  affiliateEmail: string;
  name: string;
  amountCents: number;
  commissionCount: number;
  accountHolder: string;
  ibanMasked: string;
  payoutId: string;
  link: string;
}): Promise<SendResult> {
  try {
    const name = orDash(p.name);
    const copy: MailCopy = {
      subject: `Auszahlungsantrag ${money("de", p.amountCents)} — ${name}`,
      title: "Neuer Auszahlungsantrag",
      intro: "Ein Partner hat eine Auszahlung beantragt und wartet auf die Prüfung.",
      hero: { label: "Betrag", value: money("de", p.amountCents) },
      rows: [
        ["Partner", name],
        ["E-Mail", p.affiliateEmail],
        ["Provisionen", count("de", p.commissionCount)],
        ["Kontoinhaber", orDash(p.accountHolder)],
        ["IBAN", orDash(p.ibanMasked)],
        ["Antragsnummer", p.payoutId],
      ],
      cta: { label: "Im Admin öffnen", href: p.link },
      // Stated in the mail so the omission reads as a decision rather than a
      // bug the next time someone wonders where the account number is.
      note: "Die vollständige IBAN steht im Admin hinter „IBAN anzeigen“ — bewusst nicht in dieser E-Mail, weil ein Postfach der falsche Ort dafür ist. Die Überweisung führst du in deiner Bank aus; das System überweist nichts.",
    };
    return await deliverAdmin(copy, "payout-requested-admin");
  } catch (err) {
    console.error(
      "[affiliate] payout-requested-admin: could not build the mail:",
      err,
    );
    return { ok: false, reason: "failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Payout paid                                                              */
/* -------------------------------------------------------------------------- */

interface PaidVars {
  amount: string;
  reference: string;
  link: string;
}

const PAYOUT_PAID: Record<Locale, (v: PaidVars) => MailCopy> = {
  de: (v) => ({
    subject: `Auszahlung überwiesen: ${v.amount}`,
    title: "Das Geld ist raus",
    intro: "Deine Auszahlung wurde überwiesen.",
    hero: { label: "Überwiesener Betrag", value: v.amount },
    rows: [["Verwendungszweck", v.reference]],
    cta: { label: "Partner-Dashboard öffnen", href: v.link },
    note: "Je nach Bank dauert die Gutschrift ein bis zwei Werktage.",
  }),
  en: (v) => ({
    subject: `Payout sent: ${v.amount}`,
    title: "The money is on its way",
    intro: "Your payout has been transferred.",
    hero: { label: "Amount transferred", value: v.amount },
    rows: [["Reference", v.reference]],
    cta: { label: "Open partner dashboard", href: v.link },
    note: "Depending on your bank it takes one to two business days to arrive.",
  }),
  es: (v) => ({
    subject: `Pago enviado: ${v.amount}`,
    title: "El dinero va en camino",
    intro: "Hemos transferido tu pago.",
    hero: { label: "Importe transferido", value: v.amount },
    rows: [["Concepto", v.reference]],
    cta: { label: "Abrir el panel de socio", href: v.link },
    note: "Según tu banco, el abono tarda uno o dos días laborables.",
  }),
  fr: (v) => ({
    subject: `Versement effectué : ${v.amount}`,
    title: "L'argent est parti",
    intro: "Ton versement a été viré.",
    hero: { label: "Montant viré", value: v.amount },
    rows: [["Référence", v.reference]],
    cta: { label: "Ouvrir le tableau de bord partenaire", href: v.link },
    note: "Selon ta banque, le crédit arrive sous un à deux jours ouvrés.",
  }),
};

export async function sendPayoutPaid(
  to: string,
  p: { locale: Locale; amountCents: number; reference: string; link: string },
): Promise<SendResult> {
  try {
    const l = lang(p.locale);
    const copy = PAYOUT_PAID[l]({
      amount: money(l, p.amountCents),
      reference: orDash(p.reference),
      link: p.link,
    });
    // An empty reference row would show a dash where a bank reference belongs.
    // Better to leave the row out than to print a placeholder.
    if (!p.reference?.trim()) copy.rows = undefined;
    return await deliver(to, copy, l, FOOTER[l], "payout-paid");
  } catch (err) {
    console.error("[affiliate] payout-paid: could not build the mail:", err);
    return { ok: false, reason: "failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* 6. Payout rejected                                                          */
/* -------------------------------------------------------------------------- */

interface RejectedVars {
  amount: string;
  reason: string;
  link: string;
}

const PAYOUT_REJECTED: Record<Locale, (v: RejectedVars) => MailCopy> = {
  de: (v) => ({
    subject: "Auszahlung abgelehnt",
    title: "Antrag abgelehnt",
    intro: "Wir konnten deinen Auszahlungsantrag nicht ausführen.",
    hero: { label: "Betroffener Betrag", value: v.amount },
    rows: [["Grund", v.reason]],
    cta: { label: "Partner-Dashboard öffnen", href: v.link },
    note: "Deine Provisionen bleiben bestehen und sind weiterhin auszahlbar. Sobald der Punkt geklärt ist, kannst du erneut beantragen.",
  }),
  en: (v) => ({
    subject: "Payout declined",
    title: "Request declined",
    intro: "We could not process your payout request.",
    hero: { label: "Amount concerned", value: v.amount },
    rows: [["Reason", v.reason]],
    cta: { label: "Open partner dashboard", href: v.link },
    note: "Your commissions stay on your account and remain payable. Once this is sorted out you can request again.",
  }),
  es: (v) => ({
    subject: "Pago rechazado",
    title: "Solicitud rechazada",
    intro: "No hemos podido procesar tu solicitud de pago.",
    hero: { label: "Importe afectado", value: v.amount },
    rows: [["Motivo", v.reason]],
    cta: { label: "Abrir el panel de socio", href: v.link },
    note: "Tus comisiones se mantienen y siguen siendo pagables. En cuanto se aclare, puedes volver a solicitarlo.",
  }),
  fr: (v) => ({
    subject: "Versement refusé",
    title: "Demande refusée",
    intro: "Nous n'avons pas pu traiter ta demande de versement.",
    hero: { label: "Montant concerné", value: v.amount },
    rows: [["Motif", v.reason]],
    cta: { label: "Ouvrir le tableau de bord partenaire", href: v.link },
    note: "Tes commissions restent acquises et restent versables. Une fois le point réglé, tu peux refaire une demande.",
  }),
};

export async function sendPayoutRejected(
  to: string,
  p: { locale: Locale; amountCents: number; reason: string; link: string },
): Promise<SendResult> {
  try {
    const l = lang(p.locale);
    const copy = PAYOUT_REJECTED[l]({
      amount: money(l, p.amountCents),
      reason: orDash(p.reason),
      link: p.link,
    });
    return await deliver(to, copy, l, FOOTER[l], "payout-rejected");
  } catch (err) {
    console.error("[affiliate] payout-rejected: could not build the mail:", err);
    return { ok: false, reason: "failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* 7. Application received — the operator's copy                               */
/* -------------------------------------------------------------------------- */

export async function sendApplicationReceivedAdmin(p: {
  affiliateEmail: string;
  name: string;
  link: string;
}): Promise<SendResult> {
  try {
    const name = orDash(p.name);
    const copy: MailCopy = {
      subject: `Neue Partner-Bewerbung — ${name}`,
      title: "Bewerbung wartet auf Freigabe",
      intro:
        "Eine neue Bewerbung für das Partnerprogramm ist eingegangen. Ohne Freigabe verdient dieser Partner nichts.",
      rows: [
        ["Name", name],
        ["E-Mail", p.affiliateEmail],
      ],
      cta: { label: "Bewerbung prüfen", href: p.link },
      // The address and the account number stay where they are protected.
      note: "Adresse und Zahlungsdaten stehen im Admin, nicht in dieser E-Mail.",
    };
    return await deliverAdmin(copy, "application-received-admin");
  } catch (err) {
    console.error(
      "[affiliate] application-received-admin: could not build the mail:",
      err,
    );
    return { ok: false, reason: "failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* 8. Application approved                                                     */
/* -------------------------------------------------------------------------- */

interface ApprovedVars {
  code: string;
  link: string;
}

const APPLICATION_APPROVED: Record<Locale, (v: ApprovedVars) => MailCopy> = {
  de: (v) => ({
    subject: "Du bist jetzt FaceScan-Partner",
    title: "Bewerbung freigegeben",
    intro:
      "Dein Partnerzugang ist offen. Ab sofort zählt jeder Kauf, der über deinen Link kommt.",
    hero: { label: "Dein Partnercode", value: v.code },
    cta: { label: "Zum Partner-Dashboard", href: v.link },
    note: "Deinen persönlichen Link, den QR-Code und deine Zahlen findest du im Dashboard.",
  }),
  en: (v) => ({
    subject: "You are now a FaceScan partner",
    title: "Application approved",
    intro:
      "Your partner access is open. From now on every purchase that comes through your link counts.",
    hero: { label: "Your partner code", value: v.code },
    cta: { label: "Go to the partner dashboard", href: v.link },
    note: "Your personal link, the QR code and your numbers are all in the dashboard.",
  }),
  es: (v) => ({
    subject: "Ya eres socio de FaceScan",
    title: "Solicitud aprobada",
    intro:
      "Tu acceso de socio está activo. A partir de ahora cuenta cada compra que llegue por tu enlace.",
    hero: { label: "Tu código de socio", value: v.code },
    cta: { label: "Ir al panel de socio", href: v.link },
    note: "Tu enlace personal, el código QR y tus cifras están en el panel.",
  }),
  fr: (v) => ({
    subject: "Tu es désormais partenaire FaceScan",
    title: "Candidature validée",
    intro:
      "Ton accès partenaire est ouvert. Désormais, chaque achat passé par ton lien compte.",
    hero: { label: "Ton code partenaire", value: v.code },
    cta: { label: "Aller au tableau de bord partenaire", href: v.link },
    note: "Ton lien personnel, le QR code et tes chiffres sont dans le tableau de bord.",
  }),
};

export async function sendApplicationApproved(
  to: string,
  p: { locale: Locale; code: string; link: string },
): Promise<SendResult> {
  try {
    const l = lang(p.locale);
    const copy = APPLICATION_APPROVED[l]({ code: p.code, link: p.link });
    return await deliver(to, copy, l, FOOTER[l], "application-approved");
  } catch (err) {
    console.error(
      "[affiliate] application-approved: could not build the mail:",
      err,
    );
    return { ok: false, reason: "failed" };
  }
}

/* -------------------------------------------------------------------------- */
/* 9. Application rejected                                                     */
/* -------------------------------------------------------------------------- */

const APPLICATION_REJECTED: Record<Locale, (reason: string) => MailCopy> = {
  de: (reason) => ({
    subject: "Deine Partner-Bewerbung",
    title: "Bewerbung abgelehnt",
    intro:
      "Wir haben deine Bewerbung für das Partnerprogramm geprüft und können sie nicht annehmen.",
    rows: [["Grund", reason]],
    note: "Dein FaceScan-Konto und deine gekauften Analysen sind davon nicht betroffen.",
  }),
  en: (reason) => ({
    subject: "Your partner application",
    title: "Application declined",
    intro:
      "We have reviewed your application for the partner programme and cannot accept it.",
    rows: [["Reason", reason]],
    note: "Your FaceScan account and the analyses you bought are not affected.",
  }),
  es: (reason) => ({
    subject: "Tu solicitud de socio",
    title: "Solicitud rechazada",
    intro:
      "Hemos revisado tu solicitud para el programa de socios y no podemos aceptarla.",
    rows: [["Motivo", reason]],
    note: "Tu cuenta de FaceScan y los análisis que has comprado no se ven afectados.",
  }),
  fr: (reason) => ({
    subject: "Ta candidature partenaire",
    title: "Candidature refusée",
    intro:
      "Nous avons examiné ta candidature au programme partenaire et ne pouvons pas l'accepter.",
    rows: [["Motif", reason]],
    note: "Ton compte FaceScan et les analyses que tu as achetées ne sont pas concernés.",
  }),
};

export async function sendApplicationRejected(
  to: string,
  p: { locale: Locale; reason: string },
): Promise<SendResult> {
  try {
    const l = lang(p.locale);
    const copy = APPLICATION_REJECTED[l](orDash(p.reason));
    return await deliver(to, copy, l, FOOTER[l], "application-rejected");
  } catch (err) {
    console.error(
      "[affiliate] application-rejected: could not build the mail:",
      err,
    );
    return { ok: false, reason: "failed" };
  }
}
