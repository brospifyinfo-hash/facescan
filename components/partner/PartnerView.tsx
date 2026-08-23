"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ApplyForm } from "./ApplyForm";
import { CommissionList, type CommissionRow } from "./CommissionList";
import { LevelLadder } from "./LevelLadder";
import { LevelRing } from "./LevelRing";
import { LinkBlock } from "./LinkBlock";
import { PartnerIntro } from "./PartnerIntro";
import { PartnerStats } from "./PartnerStats";
import { PayoutPanel, type PublicPayout } from "./PayoutPanel";
import type { AffiliateAddress, AffiliateStatus, LevelRule } from "@/lib/affiliate/model";
import { fill, useT } from "@/lib/i18n";

// The whole partner route, client side.
//
// ONE ROUTE, SEVEN STATES, AND EVERY ONE OF THEM SAYS SOMETHING.
//   signed out          the explainer plus the way in
//   programme off       a plain statement, and no form to fill in
//   no partner record   the application
//   pending             a waiting screen, because the wait is the state
//   blocked             the fact, and a way to reach a person
//   active              the dashboard
//   load failed         an error with a retry, never a blank page
// The eighth case is not a state but a strip over the top: an affiliate
// store with no persistent backing. It cannot keep a click, so it says so
// rather than quietly losing them.
//
// IDENTITY IS NEVER SENT FROM HERE. There is no email in any request this
// component makes; /api/affiliate/me reads the session cookie and answers
// for whoever that is. A partner therefore cannot ask for somebody else's
// numbers by editing anything in the browser.

interface PublicAffiliate {
  code: string;
  status: AffiliateStatus;
  link: string;
  /** Null until the partner is active — there is no link to encode before then. */
  qrSvg: string | null;
  firstName: string;
  lastName: string;
  address: AffiliateAddress;
  accountHolder: string;
  ibanMasked: string;
  createdAt: number;
  level: number;
  levelLabel: string;
  percent: number;
  minCents: number;
}

interface MeResponse {
  enabled: boolean;
  joinMode: "open" | "code";
  requireApproval: boolean;
  terms: string;
  holdDays: number;
  backing: "redis" | "sheets" | "memory";
  persistent: boolean;
  levels: LevelRule[];
  origin: string;
  affiliate: PublicAffiliate | null;
  summary: {
    clicks: number;
    signups: number;
    payingCustomers: number;
    revenueCents: number;
    earnedCents: number;
    paidCents: number;
    pendingCents: number;
    availableCents: number;
    requestedCents: number;
  };
  progress: { current: LevelRule; next: LevelRule | null; need: number };
  commissions: CommissionRow[];
  payouts: PublicPayout[];
  openPayout: boolean;
}

type Phase =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "error" }
  | { kind: "ready"; data: MeResponse };

export function PartnerView() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate/me", { cache: "no-store" });
      // 401 is not a failure here, it is the signed-out state: this route is
      // also the public explainer, so an anonymous visitor is expected.
      if (res.status === 401 || res.status === 403) {
        setPhase({ kind: "signedOut" });
        return;
      }
      if (!res.ok) {
        setPhase({ kind: "error" });
        return;
      }
      const data = (await res.json()) as MeResponse;
      setPhase({ kind: "ready", data });
    } catch {
      setPhase({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 pb-24 lg:max-w-3xl">
      <Link
        href="/"
        className="interactive mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-[12px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t.partner.back}
      </Link>

      {phase.kind === "loading" ? (
        <p className="t-caption py-16 text-center text-[var(--color-ink-tertiary)]">
          {t.partner.loading}
        </p>
      ) : null}

      {phase.kind === "error" ? (
        <section className="py-10">
          <h1 className="t-title2">{t.partner.errorTitle}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.partner.errorBody}
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              setPhase({ kind: "loading" });
              void load();
            }}
          >
            {t.partner.retry}
          </Button>
        </section>
      ) : null}

      {phase.kind === "signedOut" ? <PartnerIntro /> : null}

      {phase.kind === "ready" ? (
        <Ready
          data={phase.data}
          editing={editing}
          setEditing={setEditing}
          reload={() => {
            setEditing(false);
            void load();
          }}
        />
      ) : null}
    </main>
  );
}

function Ready({
  data,
  editing,
  setEditing,
  reload,
}: {
  data: MeResponse;
  editing: boolean;
  setEditing: (v: boolean) => void;
  reload: () => void;
}) {
  const t = useT();
  const aff = data.affiliate;

  const volatileNote = !data.persistent ? (
    // Not an error and not hidden either. A memory-backed store answers every
    // request correctly and forgets everything on the next deploy; somebody
    // about to hand over an IBAN deserves to know that before they do.
    <section className="mb-6 rounded-[var(--r-control)] border border-[var(--color-caution)]/35 bg-[var(--color-caution)]/[0.06] px-4 py-3">
      <p className="text-[12.5px] font-semibold text-[var(--color-caution)]">
        {t.partner.volatileTitle}
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-ink-secondary)]">
        {t.partner.volatileBody}
      </p>
    </section>
  ) : null;

  // The programme is off. An existing partner still sees what they have
  // earned — that money was booked while it was on — but nobody is invited
  // to join and nothing promises a future commission.
  if (!data.enabled && (!aff || aff.status !== "active")) {
    return (
      <>
        {volatileNote}
        <PartnerIntro disabled />
      </>
    );
  }

  if (!aff) {
    return (
      <>
        {volatileNote}
        <PartnerIntro />
        <div className="mt-9">
          <ApplyForm
            mode="apply"
            joinMode={data.joinMode}
            terms={data.terms}
            onDone={reload}
          />
        </div>
      </>
    );
  }

  if (aff.status === "pending") {
    return (
      <>
        {volatileNote}
        <section className="py-6">
          <h1 className="t-title2">{t.partner.pendingTitle}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.partner.pendingBody}
          </p>
        </section>
      </>
    );
  }

  if (aff.status === "blocked") {
    return (
      <>
        {volatileNote}
        <section className="py-6">
          <h1 className="t-title2">{t.partner.blockedTitle}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.partner.blockedBody}
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      {volatileNote}
      {!data.enabled ? (
        <section className="mb-6 border-b border-[var(--color-hairline)] pb-5">
          <p className="text-[12.5px] font-semibold text-[var(--color-ink)]">
            {t.partner.disabledTitle}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.partner.disabledBody}
          </p>
        </section>
      ) : null}

      <Dashboard data={data} affiliate={aff} editing={editing} setEditing={setEditing} reload={reload} />
    </>
  );
}

function Dashboard({
  data,
  affiliate,
  editing,
  setEditing,
  reload,
}: {
  data: MeResponse;
  affiliate: PublicAffiliate;
  editing: boolean;
  setEditing: (v: boolean) => void;
  reload: () => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const [showTerms, setShowTerms] = useState(false);

  const { current, next, need } = data.progress;
  const paying = data.summary.payingCustomers;

  // How far along this rung the partner stands. The ring and the bar read the
  // same number so they can never disagree; at the top rung it is full,
  // because there is nothing left to fill toward.
  const span = next ? next.minReferrals - current.minReferrals : 0;
  const fraction =
    !next || span <= 0 ? 1 : Math.min(1, Math.max(0, (paying - current.minReferrals) / span));

  // THE SENTENCE THE PAGE EXISTS FOR. It names the reward in full — how many
  // customers, which level, and what the rate becomes — because "12 % more"
  // is not a reason to share a link and "then 20 % instead of 15 %" is.
  const headline = !next
    ? fill(t.partner.dash.progressMax, { percent: affiliate.percent })
    : need === 1
      ? fill(t.partner.dash.progressOne, {
          level: next.level,
          next: next.percent,
          current: affiliate.percent,
        })
      : fill(t.partner.dash.progress, {
          count: need,
          level: next.level,
          next: next.percent,
          current: affiliate.percent,
        });

  return (
    <>
      {/* On a phone the ring sits above its sentence; from lg the two share a
          row, which is the only layout difference between the two widths. */}
      <section className="lg:flex lg:items-center lg:gap-10">
        <div className="lg:shrink-0">
          <LevelRing
            level={affiliate.level}
            label={affiliate.levelLabel}
            percent={affiliate.percent}
            progress={fraction}
            atTop={!next}
            percentLine={fill(t.partner.dash.levelPercent, { percent: affiliate.percent })}
            levelWord={t.partner.dash.levelWord}
          />
        </div>

        <div className="mt-6 min-w-0 flex-1 lg:mt-0">
          <p className="text-center text-[15.5px] font-semibold leading-[1.35] text-balance text-[var(--color-ink)] lg:text-left lg:text-[18px]">
            {headline}
          </p>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-hairline)]">
            <motion.div
              className="h-full rounded-full bg-[var(--color-accent)]"
              initial={{ width: reduce ? `${fraction * 100}%` : 0 }}
              animate={{ width: `${fraction * 100}%` }}
              transition={reduce ? { duration: 0 } : { duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
            />
          </div>

          <p className="mt-2 text-center text-[11.5px] text-[var(--color-ink-tertiary)] lg:text-left">
            {t.partner.dash.progressCaption}
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-8">
        <LevelLadder levels={data.levels} current={current.level} next={next?.level ?? null} />

        <LinkBlock link={affiliate.link} code={affiliate.code} qrSvg={affiliate.qrSvg ?? ""} />

        <PartnerStats
          clicks={data.summary.clicks}
          payingCustomers={data.summary.payingCustomers}
          earnedCents={data.summary.earnedCents}
          availableCents={data.summary.availableCents}
        />

        <CommissionList items={data.commissions} />

        {editing ? (
          <ApplyForm
            mode="edit"
            joinMode={data.joinMode}
            terms={data.terms}
            initial={{
              firstName: affiliate.firstName,
              lastName: affiliate.lastName,
              address: affiliate.address,
              accountHolder: affiliate.accountHolder,
            }}
            onDone={reload}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <PayoutPanel
            availableCents={data.summary.availableCents}
            pendingCents={data.summary.pendingCents}
            paidCents={data.summary.paidCents}
            minCents={affiliate.minCents}
            holdDays={data.holdDays}
            openPayout={data.openPayout}
            payouts={data.payouts}
            payoutInfo={{
              accountHolder: affiliate.accountHolder,
              ibanMasked: affiliate.ibanMasked,
              address: affiliate.address,
            }}
            onRequested={reload}
            onEdit={() => setEditing(true)}
          />
        )}

        {data.terms ? (
          <section className="border-t border-[var(--color-hairline)] pt-6">
            <button
              type="button"
              onClick={() => setShowTerms((v) => !v)}
              className="interactive flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-tertiary)]">
                {t.partner.dash.termsTitle}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--color-ink-tertiary)] transition-transform ${showTerms ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {showTerms ? (
              <p className="mt-3 whitespace-pre-line text-[11.5px] leading-[1.55] text-[var(--color-ink-secondary)]">
                {data.terms}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
