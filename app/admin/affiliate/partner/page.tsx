import { isAdmin, adminConfigured } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminNav, AffiliateTabs } from "@/components/admin/AdminNav";
import { AffiliatePartners } from "@/components/admin/AffiliatePartners";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminAffiliatePartnerPage() {
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
    <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-24">
      <h1 className="t-title2">Partner</h1>
      <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
        Alle Partner mit ihren Zahlen. Eine Zeile aufklappen zeigt geworbene
        Kunden, Provisionen, Zahlungsdaten und alle Aktionen.
      </p>
      <AdminNav active="affiliate" />
      <AffiliateTabs active="partner" />
      <AffiliatePartners />
    </main>
  );
}
