// Delivery of the login code via Resend.
//
// Set RESEND_API_KEY and AUTH_FROM_EMAIL in .env.local. Without a key the
// route reports that delivery is unconfigured rather than pretending the
// mail went out — a silent no-op here looks exactly like a lost email and
// is miserable to debug.
//
// In development without a key the code is printed to the server console so
// the flow stays testable. That branch is guarded by NODE_ENV and must never
// run in production.

import { Resend } from "resend";
import { BRAND } from "@/lib/theme";

const FROM = process.env.AUTH_FROM_EMAIL ?? "FaceScan <onboarding@resend.dev>";

export type SendResult =
  | { ok: true; devFallback?: boolean }
  | { ok: false; reason: "unconfigured" | "failed" };

function template(code: string) {
  const spaced = code.split("").join(" ");
  return {
    subject: `${code} is your FaceScan sign-in code`,
    text: [
      `Your FaceScan sign-in code is ${code}.`,
      "",
      "It expires in 10 minutes and can only be used once.",
      "If you didn't request it, you can ignore this email — no account was created.",
    ].join("\n"),
    html: `<!doctype html><html><body style="margin:0;background:${BRAND.canvas};font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:${BRAND.inkSecondary}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:${BRAND.surface};border:1px solid #27272a;border-radius:16px;padding:32px">
        <tr><td style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.accent};padding-bottom:20px">FaceScan</td></tr>
        <tr><td style="font-size:19px;font-weight:600;color:${BRAND.ink};padding-bottom:8px">Your sign-in code</td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:${BRAND.inkSecondary};padding-bottom:24px">Enter this code to open your analysis. It expires in 10 minutes.</td></tr>
        <tr><td align="center" style="padding:18px 0;background:${BRAND.canvas};border:1px solid #27272a;border-radius:12px;font-size:30px;font-weight:600;letter-spacing:.35em;color:${BRAND.ink}">${spaced}</td></tr>
        <tr><td style="font-size:12px;line-height:1.6;color:${BRAND.inkTertiary};padding-top:24px">If you didn't request this, ignore it — no account was created.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}

export async function sendLoginCode(
  email: string,
  code: string,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] no RESEND_API_KEY — dev code for ${email}: ${code}`);
      return { ok: true, devFallback: true };
    }
    return { ok: false, reason: "unconfigured" };
  }

  try {
    const { subject, text, html } = template(code);
    const res = await new Resend(key).emails.send({
      from: FROM,
      to: email,
      subject,
      text,
      html,
    });
    if (res.error) {
      // Never log the code alongside the failure.
      console.error("[auth] Resend rejected the message:", res.error);
      return { ok: false, reason: "failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[auth] Resend threw:", err);
    return { ok: false, reason: "failed" };
  }
}
