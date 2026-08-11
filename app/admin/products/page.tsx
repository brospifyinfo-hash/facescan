import Link from "next/link";
import { currentAdmin, adminConfigured } from "@/lib/admin";
import { ProductAdmin } from "@/components/admin/ProductAdmin";

// A SERVER component, so the gate runs before anything is sent.
//
// Rendering the editor client-side and hiding it behind a flag would ship the
// whole form to anyone who asks for the URL. It would still be harmless —
// every route it calls re-checks the session — but "harmless because the API
// is right" is not a reason to hand out the admin surface.
//
// noindex because this URL is guessable and there is no reason for it to be
// in a search index.
export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const admin = await currentAdmin();

  if (!admin) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="t-title3">Kein Zugriff</h1>
        <p className="t-caption mt-2 leading-relaxed text-[var(--color-ink-secondary)]">
          {adminConfigured()
            ? "Melde dich mit einer Adresse an, die in ADMIN_EMAILS steht."
            : "ADMIN_EMAILS ist nicht gesetzt. Ohne diese Liste hat niemand Adminrechte — das ist Absicht, damit ein nicht konfiguriertes Deployment keinen offenen Katalog-Editor hat."}
        </p>
        <Link
          href="/"
          className="mt-5 inline-block text-[13px] font-medium text-[var(--color-accent)]"
        >
          Zur Startseite
        </Link>
      </main>
    );
  }

  return <ProductAdmin admin={admin} />;
}
