import { isAdmin, adminConfigured } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminNav, AffiliateTabs } from "@/components/admin/AdminNav";
import { AffiliateSettings } from "@/components/admin/AffiliateSettings";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminAffiliateSettingsPage() {
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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-24">
      <h1 className="t-title2">Einstellungen</h1>
      <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
        Diese Werte gelten ab dem nächsten Kauf. Bereits gebuchte Provisionen
        behalten ihren Prozentsatz und ihr Level.
      </p>
      <AdminNav active="affiliate" />
      <AffiliateTabs active="einstellungen" />
      <AffiliateSettings />
    </main>
  );
}
