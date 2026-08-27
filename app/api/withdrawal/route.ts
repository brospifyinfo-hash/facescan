import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth/session";
import { isEmail, normalizeEmail } from "@/lib/auth/store";
import { sendWithdrawal } from "@/lib/withdrawal/email";
import {
  MAX_SENDS_PER_WINDOW,
  SEND_WINDOW_MS,
  supportThrottle,
} from "@/lib/support/store";

export const runtime = "nodejs";

/** Großzügig für eine Erklärung, zu knapp für eine Textwand. */
const LIMITS = {
  name: 120,
  email: 200,
  orderRef: 120,
  orderedAt: 60,
  address: 300,
  reason: 2000,
} as const;

function throttleKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  // Eigener Namensraum. Wer vier Support-Anfragen gestellt hat, darf immer
  // noch widerrufen — eine Frist ist kein Kontingent.
  return `wd:${forwarded?.split(",")[0]?.trim() || "unknown"}`;
}

/**
 * Ein Widerruf, abgegeben über das Formular auf /withdrawal.
 *
 * WIE BEIM SUPPORT OHNE ANMELDUNG. Der Widerruf ist ein Gestaltungsrecht,
 * kein Kontofeature — ihn hinter einen Login zu stellen hieße, ihn genau
 * dem zu verwehren, der nicht mehr hineinkommt. Die Sitzung füllt das
 * Formular nur vor.
 *
 * ES GIBT KEINEN STILLEN FEHLSCHLAG. Anders als eine Support-Anfrage läuft
 * hier eine Frist. Kommt die Erklärung nicht bei uns an, sagt diese Route
 * das ausdrücklich, damit die Oberfläche auf Post und E-Mail verweisen
 * kann — Wege, die von unserer Technik nicht abhängen.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Honigtopf, wie beim Support: unbeschriftet, außerhalb des Bildes, und
  // ein Treffer wird mit 200 beantwortet statt mit einem Fehler — wer einen
  // Fehler bekommt, versucht es noch einmal.
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ ok: true, receiptSent: true });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = normalizeEmail(str(body.email));
  const orderRef = str(body.orderRef);
  const orderedAt = str(body.orderedAt);
  const address = str(body.address);
  const reason = str(body.reason);

  // Nur Name und Adresse sind Pflicht. Ein Widerruf braucht KEINE Begründung
  // (§355 Abs. 1 BGB), und wer die Bestellnummer nicht zur Hand hat, darf
  // trotzdem widerrufen — beides abzufragen wäre eine Hürde, die das Gesetz
  // nicht kennt.
  if (!name || !email) {
    return NextResponse.json({ error: "incomplete" }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    orderRef.length > LIMITS.orderRef ||
    orderedAt.length > LIMITS.orderedAt ||
    address.length > LIMITS.address ||
    reason.length > LIMITS.reason
  ) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  const key = throttleKey(req);
  const sends = await supportThrottle.sendsInWindow(key);
  if (sends.length >= MAX_SENDS_PER_WINDOW) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfterMs: Math.max(0, sends[0] + SEND_WINDOW_MS - Date.now()),
      },
      { status: 429 },
    );
  }

  // Eine kaputte Sitzung darf den Widerruf nicht blockieren — dieselbe
  // Überlegung wie in /api/support: currentSession() wirft, wenn AUTH_SECRET
  // fehlt, und dann wäre ausgerechnet der Rückweg zu.
  let session: Awaited<ReturnType<typeof currentSession>> = null;
  try {
    session = await currentSession();
  } catch {
    session = null;
  }

  const result = await sendWithdrawal({
    name,
    email,
    orderRef,
    orderedAt,
    address,
    reason,
    sessionEmail: session ? normalizeEmail(session.email) : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === "unconfigured" ? 501 : 502 },
    );
  }

  await supportThrottle.recordSend(key);

  // receiptSent sagt der Oberfläche, ob der Kunde seine Bestätigung per Mail
  // bekommt. Ist sie false, ist der Widerruf trotzdem wirksam bei uns — die
  // Seite zeigt dann zusätzlich, was auf dem Bildschirm steht, damit der
  // Kunde es sich sichern kann.
  return NextResponse.json({ ok: true, receiptSent: result.receiptSent });
}
