import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth/store";
import { decryptSecret, piiKeyConfigured } from "@/lib/affiliate/crypto";
import { formatIban } from "@/lib/affiliate/iban";
import { affiliateStore } from "@/lib/affiliate/store";

export const runtime = "nodejs";

// The one place in the admin area where a stored IBAN becomes readable again.
//
// A SEPARATE ROUTE ON PURPOSE. The partner list and the payout list could
// easily have carried the plaintext along; then every page view of the admin
// area would put a hundred bank details through the log-and-cache path of a
// framework, a proxy and a browser. Here it takes a deliberate click, one
// partner at a time, and nothing else on the screen is decrypted.
//
// THE ACCESS IS LOGGED, THE VALUE IS NOT. Who was looked at and when is the
// part that matters in a dispute; writing the number itself into the log would
// defeat the encryption it was just released from — a log line is copied to
// stdout, to a log drain and to whoever can read them.

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = normalizeEmail(new URL(request.url).searchParams.get("email") ?? "");
  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  // Checked before the lookup: without the key nothing can be decrypted, and
  // an operator who has just changed environments deserves to be told that
  // rather than shown "no IBAN on file".
  if (!piiKeyConfigured()) {
    return NextResponse.json({ error: "pii_unconfigured" }, { status: 503 });
  }

  let ibanEnc: string;
  try {
    const aff = await affiliateStore.getAffiliate(email);
    if (!aff) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!aff.ibanEnc) return NextResponse.json({ error: "no_iban" }, { status: 404 });
    ibanEnc = aff.ibanEnc;
  } catch (err) {
    console.error("[affiliate] reveal-iban: store unavailable:", err);
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }

  try {
    const iban = formatIban(decryptSecret(ibanEnc));
    console.info(`[affiliate] IBAN revealed for ${email} at ${new Date().toISOString()}`);
    return NextResponse.json({ iban });
  } catch (err) {
    // A ciphertext that will not open is either a tampered row or a key that
    // was rotated without re-encrypting. Both mean: do not pay against this
    // record until somebody has looked at it.
    console.error(`[affiliate] reveal-iban: could not decrypt the record of ${email}:`, err);
    return NextResponse.json({ error: "decrypt_failed" }, { status: 500 });
  }
}
