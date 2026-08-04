import { NextResponse } from "next/server";
import { sendLoginCode } from "@/lib/auth/email";
import {
  generateCode,
  hashCode,
  isEmail,
  MAX_SENDS_PER_WINDOW,
  normalizeEmail,
  otpStore,
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
} from "@/lib/auth/store";

export const runtime = "nodejs";

/**
 * Issue a login code.
 *
 * Deliberately does not distinguish "known address" from "unknown address" —
 * there are no accounts to enumerate, and keeping the response uniform means
 * this endpoint can never be used to probe who has signed up.
 */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  if (!isEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // Throttle: a short cooldown between sends plus a window cap, so the
  // endpoint can't be turned into an inbox-flooding tool.
  const sends = await otpStore.sendsInWindow(email);
  const last = sends[sends.length - 1];
  if (last && Date.now() - last < RESEND_COOLDOWN_MS) {
    return NextResponse.json(
      {
        error: "cooldown",
        retryAfterMs: RESEND_COOLDOWN_MS - (Date.now() - last),
      },
      { status: 429 },
    );
  }
  if (sends.length >= MAX_SENDS_PER_WINDOW) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const code = generateCode();
  const result = await sendLoginCode(email, code);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "unconfigured" ? 501 : 502 },
    );
  }

  await otpStore.put(email, {
    codeHash: hashCode(code),
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  });
  await otpStore.recordSend(email);

  return NextResponse.json({
    ok: true,
    expiresInMs: CODE_TTL_MS,
    // Dev-only signal so the UI can tell the tester to read the terminal.
    devFallback: result.devFallback ?? false,
  });
}
