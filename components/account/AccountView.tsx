"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, KeyRound, LogOut, Receipt, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuthModal } from "@/components/auth/AuthModal";
import { fetchSession } from "@/lib/auth/client";
import { fmtDelta, fmtScore, summarise, type ScanRecord } from "@/lib/home/summary";
import { useI18n, useT } from "@/lib/i18n";
import type { HistoryEntry } from "@/lib/history/store";
import type { Payment } from "@/lib/stripe/entitlements";
import type { BandId, MetricId } from "@/lib/metrics";
import { cn } from "@/lib/cn";

// The customer's profile. Open layout on the colour fields, like everything
// else: sections divided by hairlines, chrome only on controls.
//
// Both lists come from the server keyed on the SESSION address — never on
// anything this component supplies — so the page cannot be pointed at
// somebody else's history by editing a URL.
//
// EVERY SCAN OPENS. A row expands into the five module scores as bars plus
// the full measurement set (stored since the detail column exists; older
// rows show the summary they have). That is the promise of the account: the
// numbers the customer saw are the numbers they can come back to.

export function AccountView() {
  const t = useT();
  const { locale } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [scans, setScans] = useState<HistoryEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plan, setPlan] = useState<string | null>(null);
  const [openScan, setOpenScan] = useState<string | null>(null);

  const load = useCallback(async (mail: string | null) => {
    setEmail(mail);
    setChecked(true);
    if (!mail) return;
    const [h, p] = await Promise.all([
      fetch("/api/history", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/payments", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (h) setScans(h.scans ?? []);
    if (p) {
      setPayments(p.payments ?? []);
      setPlan(p.plan ?? null);
    }
  }, []);

  useEffect(() => {
    fetchSession().then(load);
  }, [load]);

  const signOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setEmail(null);
    setScans([]);
    setPayments([]);
    setPlan(null);
  };

  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const money = (p: Payment) =>
    p.amount === null || p.currency === null
      ? "—"
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: p.currency.toUpperCase(),
        }).format(p.amount / 100);

  if (!checked) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <p className="t-caption text-center text-[var(--color-ink-tertiary)]">
          {t.account.loading}
        </p>
      </main>
    );
  }

  if (!email) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-16 text-center">
        <h1 className="t-title2">{t.account.title}</h1>
        <p className="t-caption mx-auto mt-2 max-w-xs leading-relaxed text-[var(--color-ink-secondary)]">
          {t.account.signedOutBody}
        </p>
        <Button className="mx-auto mt-6" onClick={() => setAuthOpen(true)}>
          {t.account.signIn}
        </Button>

        <AuthModal
          start="login"
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onSignedIn={(mail) => {
            setAuthOpen(false);
            void load(mail);
          }}
        />
      </main>
    );
  }

  const summary = summarise(scans as ScanRecord[]);
  const best = scans.length ? Math.max(...scans.map((s) => s.overall)) : null;

  const stats: Array<{ value: string; unit?: string; label: string }> = [
    { value: String(summary.count), unit: t.home.stats.scansUnit, label: t.home.stats.scansLabel },
    { value: fmtScore(summary.avgScore), unit: t.results.outOf, label: t.home.stats.avgLabel },
    { value: fmtDelta(summary.improvement), label: t.home.stats.deltaLabel },
    { value: best === null ? "—" : best.toFixed(1), unit: t.results.outOf, label: t.account.bestScore },
  ];

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 pb-24 lg:max-w-2xl">
      {/* ---- Profile head ---- */}
      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent-deep)] text-[22px] font-bold uppercase text-[var(--color-accent)]"
        >
          {email[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="t-title2">{t.account.title}</h1>
          <p className="t-caption mt-0.5 truncate text-[var(--color-ink-tertiary)]">{email}</p>
          {plan ? (
            <span className="mt-1.5 inline-block rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/[0.08] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]">
              {t.plans[plan as "raw" | "pro" | "blueprint"]?.name ?? plan}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={signOut}
          className="interactive flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink-secondary)] hover:border-white/20"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {t.account.signOut}
        </button>
      </header>

      {/* ---- The numbers so far ---- */}
      {scans.length > 0 ? (
        <section className="mt-7 grid grid-cols-2 border-t border-[var(--color-hairline)] pt-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={i}
              className={cn(
                "px-3 py-4 text-center",
                i % 2 === 1 && "border-l border-[var(--color-hairline)]",
                i >= 2 && "border-t border-[var(--color-hairline)] sm:border-t-0",
                i === 2 && "sm:border-l",
              )}
            >
              <p className="tnum text-[24px] font-bold leading-none tracking-tight text-[var(--color-ink)]">
                {s.value}
                {s.unit ? (
                  <span className="ml-0.5 text-[11px] font-normal text-[var(--color-ink-tertiary)]">
                    {s.unit}
                  </span>
                ) : null}
              </p>
              <p className="mt-1.5 text-[10.5px] leading-tight text-[var(--color-ink-tertiary)]">
                {s.label}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {/* ---- Scans ---- */}
      <section className="mt-7 border-t border-[var(--color-hairline)] pt-6">
        <h2 className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.11em] text-[var(--color-ink)]">
          <ScanFace className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
          {t.account.scansTitle}
        </h2>

        {scans.length === 0 ? (
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.account.noScans}
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {scans.map((s) => {
              const open = openScan === s.id;
              const modules: Array<{ label: string; value: number }> = [
                { label: t.results.symmetry, value: s.symmetry },
                { label: t.results.eyes, value: s.eyesScore },
                { label: t.results.jaw, value: s.jawScore },
                { label: t.results.ratios, value: s.proportionsScore },
                { label: t.results.midface, value: s.midfaceScore },
              ];
              return (
                <article
                  key={s.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02]"
                >
                  <button
                    type="button"
                    onClick={() => setOpenScan(open ? null : s.id)}
                    aria-expanded={open}
                    className="interactive flex w-full items-center gap-3 p-3.5 text-left"
                  >
                    <span className="tnum text-[24px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-accent)]">
                      {s.overall.toFixed(1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--color-ink)]">
                        {t.bands[s.band as BandId]?.label ?? "—"}
                      </span>
                      <span className="tnum mt-0.5 block text-[10.5px] text-[var(--color-ink-tertiary)]">
                        {date(s.at)} ·{" "}
                        {s.source === "vision" ? t.account.engineVision : t.account.engineGeometry}
                      </span>
                    </span>
                    {typeof s.potential === "number" ? (
                      <span className="shrink-0 text-right">
                        <span className="tnum block text-[15px] font-semibold text-[var(--color-ink)]">
                          {s.potential.toFixed(1)}
                        </span>
                        <span className="block text-[9.5px] uppercase tracking-[0.06em] text-[var(--color-ink-tertiary)]">
                          {t.account.potential}
                        </span>
                      </span>
                    ) : null}
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "h-4 w-4 shrink-0 text-[var(--color-ink-tertiary)] transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>

                  {open ? (
                    <div className="border-t border-[var(--color-hairline)] p-3.5">
                      {/* The five module scores as bars. */}
                      <dl className="space-y-2.5">
                        {modules.map((m) => (
                          <div key={m.label} className="flex items-center gap-3">
                            <dt className="w-[32%] shrink-0 truncate text-[11.5px] text-[var(--color-ink-secondary)]">
                              {m.label}
                            </dt>
                            <dd className="flex min-w-0 flex-1 items-center gap-2.5">
                              <span className="bar-track flex-1">
                                <span
                                  className="bar-fill"
                                  style={{ width: `${Math.min(100, Math.max(0, m.value))}%` }}
                                />
                              </span>
                              <span className="tnum w-8 shrink-0 text-right text-[11.5px] font-medium text-[var(--color-ink)]">
                                {Math.round(m.value)}
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {/* The full measurement set, when the row carries it. */}
                      {s.detail?.length ? (
                        <div className="mt-4">
                          <p className="t-eyebrow">{t.account.detailMetrics}</p>
                          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                            {s.detail.map((d) => (
                              <li
                                key={d.id}
                                className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-1.5"
                              >
                                <span className="min-w-0 truncate text-[11.5px] text-[var(--color-ink-secondary)]">
                                  {t.metrics[d.id as MetricId]?.label ?? d.id}
                                </span>
                                <span className="tnum shrink-0 text-[11.5px] text-[var(--color-ink-tertiary)]">
                                  {d.display}
                                  <span className="ml-2 font-medium text-[var(--color-ink)]">
                                    {Math.round(d.score)}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Security ---- */}
      <section className="mt-7 border-t border-[var(--color-hairline)] pt-6">
        <h2 className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.11em] text-[var(--color-ink)]">
          <KeyRound className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
          {t.account.securityTitle}
        </h2>
        <PasswordManager />
      </section>

      {/* ---- Payments ---- */}
      <section className="mt-7 border-t border-[var(--color-hairline)] pt-6">
        <h2 className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.11em] text-[var(--color-ink)]">
          <Receipt className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
          {t.account.paymentsTitle}
        </h2>

        {payments.length === 0 ? (
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.account.noPayments}
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {payments.map((p) => (
              <article
                key={p.paymentIntentId}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-[var(--color-ink)]">
                    {t.plans[p.plan]?.name ?? p.plan}
                  </span>
                  <span className="tnum block text-[10.5px] text-[var(--color-ink-tertiary)]">
                    {date(p.at)}
                  </span>
                </span>
                <span className="tnum shrink-0 text-[13px] font-semibold text-[var(--color-ink)]">
                  {money(p)}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mt-9 text-center">
        <Link href="/upload" className="text-[13px] font-medium text-[var(--color-accent)]">
          {t.account.newScan}
        </Link>
      </div>
    </main>
  );
}

/**
 * Set, change — the password lives HERE, behind the session, never in the
 * sign-up flow: the email code is the root credential and the reset path,
 * so an account without a password is never locked out.
 */
function PasswordManager() {
  const t = useT();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/password", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHasPassword(Boolean(d?.set)))
      .catch(() => setHasPassword(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setNote(null);
    if (pw1.length < 8) {
      setNote({ ok: false, text: t.account.passwordShort });
      return;
    }
    if (pw1 !== pw2) {
      setNote({ ok: false, text: t.account.passwordMismatch });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw1 }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setHasPassword(true);
      setEditing(false);
      setPw1("");
      setPw2("");
      setNote({ ok: true, text: t.account.passwordSaved });
    } else {
      setNote({ ok: false, text: t.account.passwordError });
    }
  };

  return (
    <div className="mt-3">
      <p className="text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
        {hasPassword === null ? "…" : hasPassword ? t.account.passwordActive : t.account.passwordNone}
      </p>

      {note?.ok && !editing ? (
        <p className="mt-2 text-[12px] text-[var(--color-accent)]">{note.text}</p>
      ) : null}

      {editing ? (
        <form onSubmit={save} className="mt-3 max-w-sm">
          <input
            type="password"
            autoComplete="new-password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            placeholder={t.account.passwordNew}
            className="w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--color-ink-tertiary)] focus:border-accent/60"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder={t.account.passwordRepeat}
            className="mt-2 w-full rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--color-ink-tertiary)] focus:border-accent/60"
          />
          {note && !note.ok ? (
            <p className="mt-2 text-[12px] text-red-400">{note.text}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={busy}>
              {t.account.passwordSave}
            </Button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setNote(null);
              }}
              className="interactive rounded-full px-4 text-[12.5px] text-[var(--color-ink-tertiary)]"
            >
              ✕
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setNote(null);
          }}
          className="interactive mt-3 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-[var(--color-ink)] hover:border-white/20"
        >
          {hasPassword ? t.account.passwordChange : t.account.passwordSet}
        </button>
      )}
    </div>
  );
}
