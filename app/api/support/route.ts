import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { isEmail, normalizeEmail } from "@/lib/auth/store";
import { sendSupportMessage } from "@/lib/support/email";
import {
  MAX_SENDS_PER_WINDOW,
  SEND_WINDOW_MS,
  supportThrottle,
} from "@/lib/support/store";

export const runtime = "nodejs";

/**
 * Field caps. Generous for a person describing a problem, and short enough
 * that the endpoint cannot be used to push a megabyte into an inbox.
 */
const LIMITS = { name: 100, email: 200, subject: 150, body: 5000 } as const;

/**
 * Who is asking, for the throttle.
 *
 * x-forwarded-for is set by Vercel's proxy and its FIRST entry is the
 * client; entries after it are proxies. A client-supplied header can lie,
 * but the value Vercel prepends cannot be removed by the caller, so the
 * first entry is the one to trust. "unknown" collapses everything without a
 * header into one bucket, which throttles them collectively — the safe
 * direction to fail.
 */
function throttleKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Receive a support message and mail it on.
 *
 * DELIBERATELY OPEN TO ANONYMOUS CALLERS. Somebody who cannot sign in is
 * precisely the person who needs to reach support, so requiring a session
 * here would lock out the most urgent case. What stands in for
 * authentication is the throttle plus the field caps; when a session does
 * exist its address rides along, because "the account this is really about"
 * is the first thing worth knowing at the other end.
 */
export async function POST(req: Request) {
  let body: {
    name?: string;
    email?: string;
    subject?: string;
    body?: string;
    locale?: string;
    company?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Honeypot. The field is off-screen and unlabelled, so a person never
  // fills it in and a form-filling bot usually does. Answering 200 rather
  // than an error is the point: a bot that is told it failed tries again.
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name ?? "").trim();
  const email = normalizeEmail(body.email ?? "");
  const subject = (body.subject ?? "").trim();
  const text = (body.body ?? "").trim();

  if (!name || !email || !subject || !text) {
    return NextResponse.json({ error: "incomplete" }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    subject.length > LIMITS.subject ||
    text.length > LIMITS.body
  ) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const key = throttleKey(req);
  const sends = await supportThrottle.sendsInWindow(key);
  if (sends.length >= MAX_SENDS_PER_WINDOW) {
    const oldest = sends[0];
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfterMs: Math.max(0, oldest + SEND_WINDOW_MS - Date.now()),
      },
      { status: 429 },
    );
  }

  // A broken session must not close the support channel.
  //
  // currentSession() reads AUTH_SECRET and THROWS when it is missing in
  // production. Everywhere else in the app that is the right behaviour —
  // refuse rather than mint forgeable sessions. Here it would mean that a
  // misconfigured deployment takes out the one page a customer would use to
  // report that the deployment is misconfigured. The address is a form
  // field either way; the session only annotates it.
  let session: Awaited<ReturnType<typeof currentSession>> = null;
  try {
    session = await currentSession();
  } catch {
    session = null;
  }
  const result = await sendSupportMessage({
    name,
    email,
    subject,
    body: text,
    sessionEmail: session ? normalizeEmail(session.email) : null,
    locale: typeof body.locale === "string" ? body.locale.slice(0, 5) : "en",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "unconfigured" ? 501 : 502 },
    );
  }

  // Recorded only after a successful send. A message the customer never got
  // delivered must not spend their allowance for the hour.
  await supportThrottle.recordSend(key);

  return NextResponse.json({ ok: true, devFallback: result.devFallback ?? false });
}
