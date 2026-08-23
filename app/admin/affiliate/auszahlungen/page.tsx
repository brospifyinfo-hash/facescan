import { isAdmin, adminConfigured } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminNav, AffiliateTabs } from "@/components/admin/AdminNav";
import { AffiliatePayouts } from "@/components/admin/AffiliatePayouts";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminAffiliatePayoutsPage() {
  if (!adminConfigured()) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="t-title3">Nicht eingerichtet</h1>
        <p className="t-caption mt-2 leading-relaxed text-[var(--color-ink-secondary)]">
          ADMIN_CODE ist nicht gesetzt.
        </p>
      </main>
    );
  }
  if (!(await isAdmin())) return <AdminLogin />;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 pb-24">
      <h1 className="t-title2">Auszahlungen</h1>
      <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
        Das System überweist nichts. Es verwaltet Anträge — die Überweisung
        führst du in deiner Bank aus und markierst sie hier als ausgezahlt.
      </p>
      <AdminNav active="affiliate" />
      <AffiliateTabs active="auszahlungen" />
      <AffiliatePayouts />
    </main>
  );
}
