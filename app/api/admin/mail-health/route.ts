import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Does mail actually work? Not "is the variable set".
//
// WHY THIS EXISTS
// ---------------
// /api/health reports `resend: Boolean(process.env.RESEND_API_KEY)` — which is
// true for a revoked key, a typo'd key, and a key from a different account.
// Every one of those looks identical from outside: the app calls Resend, Resend
// refuses, the code logs it and returns { ok: false }, and the customer waits
// for a code that will never arrive. The most common cause is not the key at
// all but the SENDER: Resend only delivers from a domain that has been verified
// in the account, and from its shared `onboarding@resend.dev` it delivers ONLY
// to the account owner's own address. A perfectly configured deployment can
// therefore mail the operator and nobody else, which is exactly the shape of
// "it works for me but customers say nothing arrives".
//
// So this asks Resend three questions that the environment cannot answer:
// is the key accepted, which domains are verified, and is the address we send
// FROM one of them.
//
// It sends nothing. Listing domains is a read, so this can be called as often
// as the operator likes without mailing anybody.

interface ResendDomain {
  name?: string;
  status?: string;
  region?: string;
}

/** "FaceScan <team@example.com>" → "example.com". */
function domainOf(from: string): string | null {
  const bare = from.match(/<([^>]+)>/)?.[1] ?? from;
  const at = bare.lastIndexOf("@");
  return at > 0 ? bare.slice(at + 1).trim().toLowerCase() : null;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.AUTH_FROM_EMAIL?.trim() ?? "";
  const alert = process.env.ADMIN_ALERT_EMAIL?.trim() ?? "";
  const fromDomain = domainOf(from);

  const base = {
    // The address itself, never the key. The operator needs to see which
    // sender is configured; the key is the one thing that must not leave.
    from: from || null,
    fromDomain,
    adminAlertEmail: alert || null,
    keyConfigured: Boolean(key),
    keyPrefix: key ? `${key.slice(0, 3)}…${key.length}` : null,
  };

  if (!key) {
    return NextResponse.json({
      ...base,
      ok: false,
      problem: "no_key",
      detail: "RESEND_API_KEY ist nicht gesetzt — es wird gar nicht erst versucht zu senden.",
    });
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
  } catch (err) {
    return NextResponse.json({
      ...base,
      ok: false,
      problem: "unreachable",
      detail: `Resend war nicht erreichbar: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  if (res.status === 401 || res.status === 403) {
    return NextResponse.json({
      ...base,
      ok: false,
      problem: "key_rejected",
      detail: `Resend weist den Schlüssel ab (HTTP ${res.status}). Er ist ungültig, widerrufen oder gehört zu einem anderen Konto.`,
    });
  }

  const body = (await res.json().catch(() => null)) as { data?: ResendDomain[] } | null;
  const domains = (body?.data ?? []).map((d) => ({
    name: d.name ?? "",
    status: d.status ?? "unknown",
  }));
  const verified = domains.filter((d) => d.status === "verified");
  const match = fromDomain ? verified.find((d) => d.name.toLowerCase() === fromDomain) : undefined;

  // The shared sandbox sender. Resend accepts it from anybody and delivers it
  // only to the address that owns the account — which is why it looks like it
  // works right up until a customer is the recipient.
  const sandbox = fromDomain === "resend.dev";

  const ok = Boolean(match) && !sandbox;

  return NextResponse.json({
    ...base,
    ok,
    domains,
    problem: ok
      ? null
      : sandbox
        ? "sandbox_sender"
        : verified.length === 0
          ? "no_verified_domain"
          : "sender_not_verified",
    detail: ok
      ? `Alles in Ordnung: ${fromDomain} ist in Resend verifiziert, Mails an beliebige Empfänger gehen raus.`
      : sandbox
        ? "Der Absender läuft über resend.dev. Resend stellt von dieser Adresse NUR an das eigene Konto zu — jede Mail an einen Kunden wird abgewiesen. Eigene Domain in Resend verifizieren und AUTH_FROM_EMAIL darauf umstellen."
        : verified.length === 0
          ? "In diesem Resend-Konto ist keine Domain verifiziert. Ohne verifizierte Domain nimmt Resend keinen Versand an."
          : `Der Absender ${from} liegt auf ${fromDomain}, verifiziert sind aber nur: ${verified
              .map((d) => d.name)
              .join(", ")}. AUTH_FROM_EMAIL auf eine dieser Domains umstellen.`,
  });
}

/**
 * Send one real mail and report exactly what Resend answered.
 *
 * The GET above proves the account is in order; only a send proves DELIVERY.
 * Between the two sits everything that actually goes wrong in practice: a
 * recipient the provider refuses, a suppression list, a bounce, a message that
 * leaves and lands in spam.
 *
 * Admin-only, and the recipient defaults to the operator mailbox — this is a
 * diagnostic, not a way to mail strangers from someone else's server.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.AUTH_FROM_EMAIL?.trim() ?? "";
  if (!key || !from) {
    return NextResponse.json({ ok: false, problem: "no_key_or_sender" }, { status: 501 });
  }

  const body = (await req.json().catch(() => null)) as { to?: unknown } | null;
  const requested = typeof body?.to === "string" ? body.to.trim() : "";
  const fallback = process.env.ADMIN_ALERT_EMAIL?.trim() || from;
  const to = (requested || fallback).match(/<([^>]+)>/)?.[1] ?? (requested || fallback);

  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ ok: false, problem: "bad_recipient", to }, { status: 400 });
  }

  const stamp = new Date().toISOString();
  try {
    const res = await new Resend(key).emails.send({
      from,
      to,
      subject: `Malook Mail-Test ${stamp.slice(11, 19)} UTC`,
      text: [
        "Diese Nachricht kommt aus dem Adminbereich von Malook.",
        "",
        `Absender : ${from}`,
        `Empfänger: ${to}`,
        `Zeit     : ${stamp}`,
        "",
        "Wenn sie angekommen ist, funktioniert der Mailversand der Seite —",
        "inklusive Login-Codes, Support-Nachrichten und den Mails des",
        "Partnerprogramms. Landet sie im Spam, fehlen der Domain vermutlich",
        "noch DMARC-Einträge.",
      ].join("\n"),
    });

    if (res.error) {
      // The whole point: the provider's own words, not our summary of them.
      console.error("[mail-health] Resend refused the test message:", res.error);
      return NextResponse.json({
        ok: false,
        problem: "rejected",
        to,
        from,
        error: { name: res.error.name, message: res.error.message },
      });
    }
    console.info(`[mail-health] test message accepted for ${to}, id ${res.data?.id}`);
    return NextResponse.json({ ok: true, to, from, id: res.data?.id ?? null, at: stamp });
  } catch (err) {
    console.error("[mail-health] test send threw:", err);
    return NextResponse.json({
      ok: false,
      problem: "threw",
      to,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
