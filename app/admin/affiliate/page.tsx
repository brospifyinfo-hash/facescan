import { isAdmin, adminConfigured } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminNav, AffiliateTabs } from "@/components/admin/AdminNav";
import { AffiliateOverview } from "@/components/admin/AffiliateOverview";

// Server component, like every other admin page: the gate runs before a byte
// of the screen is sent. The numbers themselves come from
// /api/admin/affiliate/overview, which re-checks the cookie on every call.
export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminAffiliatePage() {
  if (!adminConfigured()) return <NotConfigured />;
  if (!(await isAdmin())) return <AdminLogin />;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-24">
      <h1 className="t-title2">Affiliate</h1>
      <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
        Partnerprogramm: wer wirbt, was verdient wurde, was noch aussteht.
      </p>
      <AdminNav active="affiliate" />
      <AffiliateTabs active="uebersicht" />
      <AffiliateOverview />
    </main>
  );
}

function NotConfigured() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="t-title3">Nicht eingerichtet</h1>
      <p className="t-caption mt-2 leading-relaxed text-[var(--color-ink-secondary)]">
        ADMIN_CODE ist nicht gesetzt.
      </p>
    </main>
  );
}
