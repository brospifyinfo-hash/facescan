import { isAdmin, adminConfigured } from "@/lib/admin";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminLive } from "@/components/admin/AdminLive";
import { AdminNav } from "@/components/admin/AdminNav";

// Server component: the gate runs before anything is sent — same story as
// /admin/products. The data itself comes from /api/admin/live, which checks
// the cookie again on every poll.
export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLivePage() {
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
      <h1 className="t-title2">Live</h1>
      <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
        Wer gerade auf der Seite ist — sichtbar sind Besucher, die
        Statistik-Cookies akzeptiert haben.
      </p>
      <AdminNav active="live" />
      <AdminLive />
    </main>
  );
}
