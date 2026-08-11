"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, ScanFace, Receipt } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuthModal } from "@/components/auth/AuthModal";
import { fetchSession } from "@/lib/auth/client";
import { useI18n, useT } from "@/lib/i18n";
import type { HistoryEntry } from "@/lib/history/store";
import type { Payment } from "@/lib/stripe/entitlements";
import type { BandId } from "@/lib/metrics";

/**
 * The customer's profile: their scans, and what they paid.
 *
 * Both lists come from the server keyed on the SESSION address — never on
 * anything this component supplies — so the page cannot be pointed at
 * somebody else's history by editing a URL.
 */
export function AccountView() {
  const t = useT();
  const { locale } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [scans, setScans] = useState<HistoryEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plan, setPlan] = useState<string | null>(null);

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
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="t-title2">{t.account.title}</h1>
        <p className="t-caption mx-auto mt-2 max-w-xs leading-relaxed text-[var(--color-ink-secondary)]">
          {t.account.signedOutBody}
        </p>
        <Button className="mt-6" onClick={() => setAuthOpen(true)}>
          {t.account.signIn}
        </Button>

        <AuthModal
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

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-title2">{t.account.title}</h1>
          <p className="t-caption mt-1 truncate text-[var(--color-ink-tertiary)]">{email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-[var(--color-ink-secondary)] hover:border-white/20"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {t.account.signOut}
        </button>
      </header>

      {plan ? (
        <p className="mt-4 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.06] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]">
          {t.plans[plan as "raw" | "pro" | "blueprint"]?.name ?? plan}
        </p>
      ) : null}

      {/* ---- Scans ---- */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 px-1 text-[12.5px] font-semibold uppercase tracking-[0.11em] text-[var(--color-ink)]">
          <ScanFace className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
          {t.account.scansTitle}
        </h2>

        {scans.length === 0 ? (
          <p className="panel p-[var(--pad-panel)] text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.account.noScans}
          </p>
        ) : (
          <div className="grid gap-2">
            {scans.map((s) => (
              <article key={s.id} className="panel flex items-center gap-3 p-3">
                <span className="tnum text-[22px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-accent)]">
                  {s.overall.toFixed(1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-[var(--color-ink)]">
                    {t.bands[s.band as BandId]?.label ?? "—"}
                  </span>
                  <span className="tnum block text-[10.5px] text-[var(--color-ink-tertiary)]">
                    {date(s.at)}
                  </span>
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ---- Payments ---- */}
      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 px-1 text-[12.5px] font-semibold uppercase tracking-[0.11em] text-[var(--color-ink)]">
          <Receipt className="h-4 w-4 text-[var(--color-accent)]" aria-hidden />
          {t.account.paymentsTitle}
        </h2>

        {payments.length === 0 ? (
          <p className="panel p-[var(--pad-panel)] text-[12px] leading-relaxed text-[var(--color-ink-secondary)]">
            {t.account.noPayments}
          </p>
        ) : (
          <div className="grid gap-2">
            {payments.map((p) => (
              <article key={p.paymentIntentId} className="panel flex items-center gap-3 p-3">
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

      <div className="mt-8 text-center">
        <Link href="/upload" className="text-[13px] font-medium text-[var(--color-accent)]">
          {t.account.newScan}
        </Link>
      </div>
    </main>
  );
}
