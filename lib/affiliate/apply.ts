// Becoming a partner, and changing where the money goes.
//
// THE SERVER IS THE TRUTH. The form validates the same things in the browser
// so nobody is told about a typo after a round trip, but nothing below
// trusts that: the browser is a suggestion box. Every rule is re-checked
// here, including the mod-97 checksum, because this is the last point before
// a bank account number is written down.
//
// NO PLAINTEXT IBAN, EVER — not in production, not in development, not
// "just for now". The store behind this is a Google spreadsheet; a plaintext
// IBAN there is a data breach one stolen login away. If AFFILIATE_PII_KEY is
// missing, the application is REFUSED rather than stored in the clear. That
// is a worse day for the operator and a much better one for the partner.
//
// THE INVITE CODE IS CONSUMED LAST. A code is a scarce thing — "the first 50
// people" is exactly the case it exists for — and consuming it before the
// partner row is written would burn a use on every failed attempt.

import { normalizeEmail } from "@/lib/auth/store";
import { affiliateStore, newAffiliateCode } from "@/lib/affiliate/store";
import { normalizeCode } from "@/lib/affiliate/codes";
import { encryptSecret, piiKeyConfigured } from "@/lib/affiliate/crypto";
import { ibanCountry, ibanLast4, isValidIban, normalizeIban } from "@/lib/affiliate/iban";
import { sendApplicationReceivedAdmin, siteOrigin } from "@/lib/affiliate/email";
import type { Affiliate, AffiliateAddress } from "@/lib/affiliate/model";

export interface ApplyInput {
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  accountHolder: string;
  iban: string;
  acceptTerms: boolean;
  inviteCode?: string;
}

export type ApplyResult =
  | { ok: true; affiliate: Affiliate }
  | {
      ok: false;
      error:
        | "invalid_input"
        | "invalid_iban"
        | "terms_required"
        | "invite_required"
        | "invite_invalid"
        | "already_affiliate"
        | "pii_unconfigured"
        | "disabled"
        | "store_unavailable"
        | "not_found";
      field?: string;
      status: number;
    };

/**
 * Where a payout can actually be sent.
 *
 * The SEPA area, because the operator pays by bank transfer from a European
 * account and nothing here can send money anywhere else. An address outside
 * it is not "unsupported paperwork", it is a transfer that will bounce.
 */
export const PAYOUT_COUNTRIES = [
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB",
  "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MT", "NL",
  "NO", "PL", "PT", "RO", "SE", "SI", "SK", "SM", "VA",
] as const;

/**
 * Control characters are rejected rather than stripped.
 *
 * They have no place in a name, and silently removing them would mean the
 * partner's stored name differs from the one they typed — which is exactly
 * the kind of mismatch that makes a bank reject a transfer.
 */
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;

type Failure = Extract<ApplyResult, { ok: false }>;

const bad = (error: Failure["error"], field: string, status = 400): Failure => ({
  ok: false,
  error,
  field,
  status,
});

function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

interface ParsedInput {
  firstName: string;
  lastName: string;
  address: AffiliateAddress;
  accountHolder: string;
  /** Normalised, checksum-valid — or empty when the caller allowed it to be omitted. */
  iban: string;
  inviteCode: string;
}

/**
 * @param requireTerms  false when an existing partner edits their details —
 *                      they accepted the terms when they applied, and asking
 *                      again on every address change would be theatre.
 * @param requireIban   false for an edit: an empty field means "leave the
 *                      account I already gave you alone", because the client
 *                      never receives the stored IBAN and therefore cannot
 *                      send it back.
 */
function parseInput(
  raw: unknown,
  opts: { requireTerms: boolean; requireIban: boolean },
): { ok: true; value: ParsedInput } | Failure {
  if (!raw || typeof raw !== "object") return bad("invalid_input", "body");
  const src = raw as Record<string, unknown>;

  const between = (value: string, min: number, max: number) =>
    value.length >= min && value.length <= max && !CONTROL.test(value);

  const firstName = text(src.firstName);
  if (!between(firstName, 2, 60)) return bad("invalid_input", "firstName");

  const lastName = text(src.lastName);
  if (!between(lastName, 2, 60)) return bad("invalid_input", "lastName");

  const street = text(src.street);
  if (!between(street, 2, 120)) return bad("invalid_input", "street");

  const postalCode = text(src.postalCode);
  // Deliberately loose: postcodes range from "1" to "SW1A 1AA" across the
  // SEPA area, and a German-shaped regex would lock out real partners.
  if (!between(postalCode, 2, 12) || !/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(postalCode)) {
    return bad("invalid_input", "postalCode");
  }

  const city = text(src.city);
  if (!between(city, 2, 80)) return bad("invalid_input", "city");

  const country = text(src.country).toUpperCase();
  if (!(PAYOUT_COUNTRIES as readonly string[]).includes(country)) {
    return bad("invalid_input", "country");
  }

  const accountHolder = text(src.accountHolder);
  if (!between(accountHolder, 2, 70)) return bad("invalid_input", "accountHolder");

  const rawIban = normalizeIban(text(src.iban));
  if (rawIban.length === 0) {
    if (opts.requireIban) return bad("invalid_iban", "iban");
  } else if (!isValidIban(rawIban)) {
    // A failing checksum is nearly always a typo, and a typo here sends
    // money to a stranger's account — one that we cannot get it back from.
    return bad("invalid_iban", "iban");
  }

  if (opts.requireTerms && src.acceptTerms !== true) {
    return bad("terms_required", "acceptTerms");
  }

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      address: { street, postalCode, city, country },
      accountHolder,
      iban: rawIban,
      inviteCode: normalizeCode(text(src.inviteCode)),
    },
  };
}

/** The last ten entries only — this is an audit trail, not an archive. */
function trimHistory(history: Affiliate["history"]): Affiliate["history"] {
  return history.slice(-10);
}

/* -------------------------------------------------------------------------- */
/* Applying                                                                    */
/* -------------------------------------------------------------------------- */

export async function applyForAffiliate(email: string, input: unknown): Promise<ApplyResult> {
  const partner = normalizeEmail(email ?? "");
  if (!partner) return bad("invalid_input", "email", 401);

  try {
    const cfg = await affiliateStore.getConfig();
    if (!cfg.enabled) return { ok: false, error: "disabled", status: 403 };

    const existing = await affiliateStore.getAffiliate(partner);
    if (existing) return { ok: false, error: "already_affiliate", status: 409 };

    const parsed = parseInput(input, { requireTerms: true, requireIban: true });
    if (!parsed.ok) return parsed;

    // Checked before anything is written: refusing the application is the
    // only honest answer when the IBAN cannot be stored safely.
    if (!piiKeyConfigured()) {
      return { ok: false, error: "pii_unconfigured", status: 503 };
    }

    let invite = null;
    if (cfg.joinMode === "code") {
      if (!parsed.value.inviteCode) {
        return bad("invite_required", "inviteCode");
      }
      invite = await affiliateStore.getInvite(parsed.value.inviteCode);
      const usable =
        invite !== null &&
        !invite.disabled &&
        (invite.expiresAt === null || invite.expiresAt > Date.now()) &&
        invite.uses < invite.maxUses;
      if (!usable) return bad("invite_invalid", "inviteCode");
    }

    const now = Date.now();
    const affiliate: Affiliate = {
      email: partner,
      code: await newAffiliateCode(),
      // Approval is the operator's call. Without it a partner is active at
      // once, which is what "open" is supposed to feel like.
      status: cfg.requireApproval ? "pending" : "active",
      firstName: parsed.value.firstName,
      lastName: parsed.value.lastName,
      address: parsed.value.address,
      ibanEnc: encryptSecret(parsed.value.iban),
      ibanLast4: ibanLast4(parsed.value.iban),
      ibanCountry: ibanCountry(parsed.value.iban),
      accountHolder: parsed.value.accountHolder,
      createdAt: now,
      approvedAt: cfg.requireApproval ? null : now,
      invitedWithCode: invite ? invite.code : null,
      percentOverride: null,
      levelOverride: null,
      payoutMinOverrideCents: null,
      note: "",
      history: [{ at: now, field: "iban", ibanLast4: ibanLast4(parsed.value.iban) }],
    };

    await affiliateStore.putAffiliate(affiliate);

    // Only now. A use burned on a failed application is a use the operator
    // cannot get back, and "the code says it is used up" is unanswerable.
    if (invite) {
      await affiliateStore.putInvite({
        ...invite,
        uses: invite.uses + 1,
        usedBy: [...invite.usedBy, partner].slice(-200),
      });
    }

    if (affiliate.status === "pending") {
      try {
        await sendApplicationReceivedAdmin({
          affiliateEmail: partner,
          name: `${affiliate.firstName} ${affiliate.lastName}`.trim(),
          link: `${siteOrigin()}/admin/affiliate/partner`,
        });
      } catch (err) {
        // The partner is registered either way; the operator can still see
        // the application in the admin list.
        console.error("[affiliate] application alert mail failed:", err);
      }
    }

    return { ok: true, affiliate };
  } catch (err) {
    console.error("[affiliate] application failed:", err);
    return { ok: false, error: "store_unavailable", status: 503 };
  }
}

/* -------------------------------------------------------------------------- */
/* Editing payout details                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Change name, address, account holder and — optionally — the IBAN.
 *
 * An open payout request is NOT touched: it carries its own snapshot of the
 * details it was made against, so a change here cannot rewrite where a
 * transfer that is already being prepared was supposed to go.
 */
export async function updatePayoutInfo(email: string, input: unknown): Promise<ApplyResult> {
  const partner = normalizeEmail(email ?? "");
  if (!partner) return bad("invalid_input", "email", 401);

  try {
    const aff = await affiliateStore.getAffiliate(partner);
    if (!aff) return { ok: false, error: "not_found", status: 404 };

    const parsed = parseInput(input, { requireTerms: false, requireIban: false });
    if (!parsed.ok) return parsed;

    const changingIban = parsed.value.iban.length > 0;
    if (changingIban && !piiKeyConfigured()) {
      return { ok: false, error: "pii_unconfigured", status: 503 };
    }

    const now = Date.now();
    const history = [...aff.history];

    if (changingIban) {
      const last4 = ibanLast4(parsed.value.iban);
      // Only the last four are recorded. It is enough to answer "which
      // account was it sent to on the 3rd?" and useless to a reader of the
      // spreadsheet.
      history.push({ at: now, field: "iban", ibanLast4: last4 });
    }

    const addressChanged =
      aff.address.street !== parsed.value.address.street ||
      aff.address.postalCode !== parsed.value.address.postalCode ||
      aff.address.city !== parsed.value.address.city ||
      aff.address.country !== parsed.value.address.country ||
      aff.accountHolder !== parsed.value.accountHolder ||
      aff.firstName !== parsed.value.firstName ||
      aff.lastName !== parsed.value.lastName;
    if (addressChanged) history.push({ at: now, field: "address" });

    const next: Affiliate = {
      ...aff,
      firstName: parsed.value.firstName,
      lastName: parsed.value.lastName,
      address: parsed.value.address,
      accountHolder: parsed.value.accountHolder,
      ibanEnc: changingIban ? encryptSecret(parsed.value.iban) : aff.ibanEnc,
      ibanLast4: changingIban ? ibanLast4(parsed.value.iban) : aff.ibanLast4,
      ibanCountry: changingIban ? ibanCountry(parsed.value.iban) : aff.ibanCountry,
      history: trimHistory(history),
    };

    await affiliateStore.putAffiliate(next);
    return { ok: true, affiliate: next };
  } catch (err) {
    console.error("[affiliate] payout details update failed:", err);
    return { ok: false, error: "store_unavailable", status: 503 };
  }
}
