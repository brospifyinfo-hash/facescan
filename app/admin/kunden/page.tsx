import { isAdmin, adminConfigured } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminNav } from "@/components/admin/AdminNav";
import { CustomerAdmin } from "@/components/admin/CustomerAdmin";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminKundenPage() {
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
      <h1 className="t-title2">Kunden</h1>
      <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
        Jede Adresse mit gespeicherten Scans oder Käufen. Pläne lassen sich hier
        kostenlos vergeben (nur aufwärts).
      </p>
      <AdminNav active="kunden" />
      <CustomerAdmin />
    </main>
  );
}
