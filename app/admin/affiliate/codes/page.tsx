import { isAdmin, adminConfigured } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminNav, AffiliateTabs } from "@/components/admin/AdminNav";
import { AffiliateCodes } from "@/components/admin/AffiliateCodes";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminAffiliateCodesPage() {
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
      <h1 className="t-title2">Zugangscodes</h1>
      <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
        Nur nötig, wenn die Anmeldung in den Einstellungen auf „nur mit Code“
        steht. Generierte Codes werden hier einmal gesammelt angezeigt.
      </p>
      <AdminNav active="affiliate" />
      <AffiliateTabs active="codes" />
      <AffiliateCodes />
    </main>
  );
}
