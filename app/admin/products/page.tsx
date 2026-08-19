import { isAdmin, adminConfigured } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminNav } from "@/components/admin/AdminNav";
import { ProductAdmin } from "@/components/admin/ProductAdmin";
import { SiteImageAdmin } from "@/components/admin/SiteImageAdmin";

// A SERVER component, so the gate runs before anything is sent. Rendering the
// editor client-side behind a flag would ship the whole form to anyone who
// asks for the URL.
//
// noindex because this URL is guessable and has no business being crawled.
export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  if (!adminConfigured()) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="t-title3">Nicht eingerichtet</h1>
        <p className="t-caption mt-2 leading-relaxed text-[var(--color-ink-secondary)]">
          ADMIN_CODE ist nicht gesetzt. Ohne diese Variable hat niemand
          Adminrechte — das ist Absicht, damit ein nicht konfiguriertes
          Deployment keinen offenen Katalog-Editor hat.
        </p>
      </main>
    );
  }

  if (!(await isAdmin())) return <AdminLogin />;

  return (
    <>
      <div className="mx-auto w-full max-w-3xl px-4 pt-8">
        <AdminNav active="produkte" />
      </div>
      <ProductAdmin />
      {/* Same page, same gate. A second admin URL would be a second thing to
          remember and a second thing to protect. */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-24">
        <SiteImageAdmin />
      </div>
    </>
  );
}
