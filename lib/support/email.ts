// Delivery of a support message via Resend.
//
// Mirrors lib/auth/email.ts deliberately: same Resend call, same
// configured-or-absent stance, same dev fallback to the console. A support
// form that silently swallows a message is worse than one that is plainly
// switched off — the customer believes they have been heard and is waiting
// for an answer that will never come.
//
// WHERE IT GOES: THE SAME LADDER THE AFFILIATE MAILS USE
//
// ADMIN_ALERT_EMAIL is this deployment's operator mailbox and already
// carries the partner-programme notifications, so support mail joins it
// rather than inventing a second place to look. SUPPORT_TO_EMAIL overrides
// it for the case where support should land somewhere else than the
// operational alerts. AUTH_FROM_EMAIL is the last resort, because a mail to
// yourself still arrives.
//
// No address is hardcoded: this repository is public, and a destination in
// the source is a destination handed to every scraper that walks it. With
// none of the three set, the route reports "unconfigured" and the form says
// so rather than swallowing the message.
//
// REPLY-TO IS THE WHOLE FEATURE
//
// The message arrives FROM the verified sending domain — it has to, or
// SPF/DKIM reject it — so without an explicit reply_to, hitting reply
// answers a noreply mailbox. Setting it to the customer's address is what
// turns this from a notification into a conversation.

import { Resend } from "resend";
import { BRAND } from "@/lib/theme";

/** Falls back to the sign-in sender: one verified domain is enough to run. */
const FROM = () =>
  process.env.SUPPORT_FROM_EMAIL ??
  process.env.AUTH_FROM_EMAIL ??
  "FaceScan <onboarding@resend.dev>";

/**
 * AUTH_FROM_EMAIL is written as "FaceScan <team@example.com>" because it
 * doubles as a From header. Used as a RECIPIENT the display name has to go,
 * or Resend is handed an address it cannot parse.
 */
function bareAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return (angled ? angled[1] : value).trim();
}

/** Override, then the operator mailbox, then the sender. */
function recipient(): string | null {
  for (const candidate of [
    process.env.SUPPORT_TO_EMAIL,
    process.env.ADMIN_ALERT_EMAIL,
    process.env.AUTH_FROM_EMAIL,
  ]) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      const bare = bareAddress(trimmed);
      if (bare.includes("@")) return bare;
    }
  }
  return null;
}

export interface SupportMessage {
  name: string;
  email: string;
  subject: string;
  body: string;
  /** Signed-in address from the session cookie, when there is one. */
  sessionEmail: string | null;
  locale: string;
}

export type SendResult =
  | { ok: true; devFallback?: boolean }
  | { ok: false; reason: "unconfigured" | "failed" };

/**
 * Escape before interpolating into the HTML body.
 *
 * Every field here is attacker-controlled free text arriving at an inbox
 * that renders HTML. Unescaped, a message body is markup in the reader's
 * mail client — at best broken layout, at worst a link that is not what it
 * says it is. The plaintext part needs no escaping and gets none.
 */
function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

function template(msg: SupportMessage) {
  const received = new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
  });

  // Whether the address is merely typed or actually proven by a session is
  // the first thing worth knowing when a message claims an account problem.
  const proven =
    msg.sessionEmail && msg.sessionEmail === msg.email.toLowerCase()
      ? "signed in"
      : msg.sessionEmail
        ? `signed in as ${msg.sessionEmail}`
        : "not signed in";

  const row = (label: string, value: string) => `
        <tr>
          <td style="padding:7px 0;font-size:12px;color:${BRAND.inkTertiary};width:104px;vertical-align:top">${esc(label)}</td>
          <td style="padding:7px 0;font-size:14px;color:${BRAND.ink}">${value}</td>
        </tr>`;

  // CR/LF stripped from the subject before it becomes a header.
  //
  // The body is free to contain newlines; a header is not. A subject
  // carrying "\r\n" is the classic route to injecting extra headers (a Bcc,
  // a forged Reply-To) into an outgoing message. Resend takes JSON and
  // almost certainly rejects it too, but "the layer above probably handles
  // it" is not something to rely on for a header built from a stranger's
  // input.
  const oneLine = msg.subject.replace(/[\r\n]+/g, " ").trim();

  return {
    subject: `[Support] ${oneLine}`,
    text: [
      `Von:      ${msg.name} <${msg.email}>`,
      `Status:   ${proven}`,
      `Sprache:  ${msg.locale}`,
      `Eingang:  ${received}`,
      "",
      `Betreff:  ${oneLine}`,
      "",
      msg.body,
      "",
      "-- ",
      "Antwort auf diese Mail geht direkt an den Kunden.",
    ].join("\n"),
    html: `<!doctype html><html><body style="margin:0;background:${BRAND.canvas};font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:${BRAND.inkSecondary}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.surface};border:1px solid #27272a;border-radius:16px;padding:28px">
        <tr><td style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.accent};padding-bottom:18px">FaceScan · Support</td></tr>
        <tr><td style="font-size:18px;font-weight:600;color:${BRAND.ink};padding-bottom:18px">${esc(oneLine)}</td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row("Von", `${esc(msg.name)} &lt;<a href="mailto:${esc(msg.email)}" style="color:${BRAND.accent};text-decoration:none">${esc(msg.email)}</a>&gt;`)}
            ${row("Status", esc(proven))}
            ${row("Sprache", esc(msg.locale))}
            ${row("Eingang", esc(received))}
          </table>
        </td></tr>
        <tr><td style="padding-top:20px">
          <div style="padding:16px 18px;background:${BRAND.canvas};border:1px solid #27272a;border-radius:12px;font-size:14px;line-height:1.65;color:${BRAND.ink};white-space:pre-wrap">${esc(msg.body)}</div>
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.6;color:${BRAND.inkTertiary};padding-top:20px">Antwort auf diese Mail geht direkt an ${esc(msg.email)}.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}

export async function sendSupportMessage(
  msg: SupportMessage,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const to = recipient();

  if (!key || !to) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[support] no ${!key ? "RESEND_API_KEY" : "recipient address"} — message from ${msg.email}:\n${msg.body}`,
      );
      return { ok: true, devFallback: true };
    }
    console.error(
      `[support] ${!key ? "RESEND_API_KEY" : "no recipient (SUPPORT_TO_EMAIL / ADMIN_ALERT_EMAIL / AUTH_FROM_EMAIL)"} missing, message not sent`,
    );
    return { ok: false, reason: "unconfigured" };
  }

  try {
    const { subject, text, html } = template(msg);
    const res = await new Resend(key).emails.send({
      from: FROM(),
      to,
      replyTo: msg.email,
      subject,
      text,
      html,
    });
    if (res.error) {
      // Log the rejection, never the customer's message body alongside it.
      console.error("[support] Resend rejected the message:", res.error);
      return { ok: false, reason: "failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[support] Resend threw:", err);
    return { ok: false, reason: "failed" };
  }
}
