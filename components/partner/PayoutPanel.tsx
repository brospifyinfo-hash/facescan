"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AffiliateAddress } from "@/lib/affiliate/model";
import { fill, useI18n, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// Asking to be paid.
//
// THIS BUTTON MOVES NO MONEY, and the note under it says so. It files a
// request; a human reads it and makes a transfer from a bank. Every check
// that decides whether the request is allowed — status, minimum, an already
// open request, whether the IBAN still passes its check digits — runs again
// in lib/affiliate/payouts.ts. What is disabled here is disabled so that a
// customer is not sent to a refusal, not because the button is the guard.
//
// The reason for a disabled button is always spelled out next to it. A grey
// control with no explanation is the single most common way an earnings page
// loses somebody's trust: they have money, the button does not work, and
// nothing on screen says why.

/** One payout, exactly as /api/affiliate/me and /api/affiliate/payouts send it. */
export interface PublicPayout {
  id: string;
  amountCents: number;
  status: "requested" | "approved" | "paid" | "rejected";
  requestedAt: number;
  paidAt: number | null;
  reference: string;
  rejectionReason: string | null;
  count: number;
}

interface Props {
  availableCents: number;
  pendingCents: number;
  paidCents: number;
  minCents: number;
  holdDays: number;
  openPayout: boolean;
  payouts: PublicPayout[];
  payoutInfo: {
    accountHolder: string;
    ibanMasked: string;
    address: AffiliateAddress;
  };
  /** Reload the dashboard once a request has been filed. */
  onRequested: () => void;
  /** Open the payout-details form; the view above owns it. */
  onEdit: () => void;
}

export function PayoutPanel({
  availableCents,
  pendingCents,
  paidCents,
  minCents,
  holdDays,
  openPayout,
  payouts,
  payoutInfo,
  onRequested,
  onEdit,
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });

  const belowMinimum = availableCents < minCents || availableCents <= 0;
  const blocked = openPayout || belowMinimum;

  const request = async () => {
    if (busy || blocked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/payout", { method: "POST" });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const code = data.error ?? "generic";
        setError(
          (t.partner.dash.payoutErrors as Record<string, string>)[code] ??
            t.partner.dash.payoutErrors.generic,
        );
        return;
      }
      onRequested();
    } catch {
      setError(t.partner.dash.payoutErrors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-t border-[var(--color-hairline)] pt-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
        {t.partner.dash.payoutTitle}
      </h2>

      {/* The payable sum gets the size, because it is the only figure here
          anybody came to read. The other two are context. */}
      <p className="tnum mt-3 text-[34px] font-bold leading-none tracking-tight text-[var(--color-ink)]">
        {money(availableCents)}
      </p>
      <p className="mt-1.5 text-[12px] text-[var(--color-ink-tertiary)]">
        {t.partner.dash.payoutAvailable}
        {" · "}
        {minCents > 0 ? fill(t.partner.dash.payoutMin, { amount: money(minCents) }) : t.partner.dash.payoutNoMin}
      </p>

      <dl className="mt-4 flex gap-6">
        <div>
          <dt className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-ink-quaternary)]">
            {t.partner.dash.payoutPending}
          </dt>
          <dd className="tnum mt-1 text-[15px] font-semibold text-[var(--color-ink-secondary)]">
            {money(pendingCents)}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-ink-quaternary)]">
            {t.partner.dash.payoutPaid}
          </dt>
          <dd className="tnum mt-1 text-[15px] font-semibold text-[var(--color-ink-secondary)]">
            {money(paidCents)}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <Button size="lg" onClick={request} disabled={busy || blocked}>
          {busy ? t.partner.dash.payoutSubmitting : t.partner.dash.payoutCta}
        </Button>
        {blocked ? (
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-ink-tertiary)]">
            {openPayout
              ? t.partner.dash.payoutOpen
              : fill(t.partner.dash.payoutBelow, {
                  amount: money(Math.max(0, minCents - availableCents)),
                })}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-[12px] leading-relaxed text-[var(--color-caution)]">
            {error}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--color-ink-quaternary)]">
        {fill(t.partner.dash.payoutNote, { days: holdDays })}
      </p>

      {/* ---- Where the money goes ---- */}
      <div className="mt-6 border-t border-[var(--color-hairline)] pt-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
            {t.partner.dash.payoutInfoTitle}
          </h3>
          <button
            type="button"
            onClick={onEdit}
            className="interactive flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink-secondary)] hover:border-white/20"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {t.partner.dash.payoutInfoEdit}
          </button>
        </div>

        <dl className="mt-3 text-[12px] leading-[1.6]">
          <Row label={t.partner.dash.payoutInfoHolder} value={payoutInfo.accountHolder} />
          {/* The masked form is the ONLY one that ever reaches this browser.
              The full IBAN is encrypted in the store and decrypted in the
              admin alone — see lib/affiliate/crypto.ts. */}
          <Row label={t.partner.dash.payoutInfoIban} value={payoutInfo.ibanMasked} mono />
          <Row
            label={t.partner.dash.payoutInfoAddress}
            value={[
              payoutInfo.address.street,
              `${payoutInfo.address.postalCode} ${payoutInfo.address.city}`.trim(),
              payoutInfo.address.country,
            ]
              .filter(Boolean)
              .join(", ")}
          />
        </dl>
      </div>

      {/* ---- The requests filed so far ---- */}
      <div className="mt-6 border-t border-[var(--color-hairline)] pt-5">
        <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
          {t.partner.dash.payoutHistory}
        </h3>

        {payouts.length === 0 ? (
          <p className="mt-2 text-[12px] text-[var(--color-ink-tertiary)]">
            {t.partner.dash.payoutNone}
          </p>
        ) : (
          <ul className="mt-2">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-3 border-t border-[var(--color-hairline)] py-3 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-semibold leading-tight text-[var(--color-ink)]">
                    <span className="tnum">{money(p.amountCents)}</span>
                    <span className="tnum text-[11px] font-normal text-[var(--color-ink-tertiary)]">
                      {date(p.requestedAt)}
                      {" · "}
                      {fill(t.partner.dash.payoutCount, { count: p.count })}
                    </span>
                  </p>
                  <p className="mt-1.5">
                    <span
                      className={cn(
                        "inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em]",
                        p.status === "paid" &&
                          "border-[var(--color-accent)]/45 bg-[var(--color-accent-deep)] text-[var(--color-accent)]",
                        (p.status === "requested" || p.status === "approved") &&
                          "border-[var(--color-caution)]/40 text-[var(--color-caution)]",
                        p.status === "rejected" &&
                          "border-[var(--color-hairline)] text-[var(--color-ink-tertiary)]",
                      )}
                    >
                      {t.partner.dash.payoutStatus[p.status]}
                    </span>
                  </p>
                  {p.reference ? (
                    <p className="mt-1.5 text-[11px] leading-tight text-[var(--color-ink-tertiary)]">
                      {t.partner.dash.payoutReference}:{" "}
                      <span className="font-mono">{p.reference}</span>
                    </p>
                  ) : null}
                  {p.rejectionReason ? (
                    <p className="mt-1 text-[11px] leading-tight text-[var(--color-ink-tertiary)]">
                      {t.partner.dash.payoutReason}: {p.rejectionReason}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 border-t border-[var(--color-hairline)] py-2 first:border-t-0">
      <dt className="w-28 shrink-0 text-[var(--color-ink-tertiary)]">{label}</dt>
      <dd className={cn("min-w-0 flex-1 text-[var(--color-ink)]", mono && "font-mono tracking-[0.08em]")}>
        {value || "—"}
      </dd>
    </div>
  );
}
