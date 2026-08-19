import Link from "next/link";

// The cockpit's own navigation — three rooms, one line. Server-renderable,
// no state: the active page just passes its own key.
const TABS = [
  { key: "live", href: "/admin/live", label: "Live" },
  { key: "kunden", href: "/admin/kunden", label: "Kunden" },
  { key: "produkte", href: "/admin/products", label: "Produkte & Bilder" },
] as const;

export function AdminNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="mt-4 flex gap-1.5" aria-label="Admin-Bereiche">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={
            active === t.key
              ? "rounded-full bg-[var(--color-accent)] px-4 py-2 text-[12.5px] font-semibold text-[var(--color-accent-ink)]"
              : "rounded-full border border-white/[0.1] px-4 py-2 text-[12.5px] font-medium text-[var(--color-ink-secondary)] hover:border-white/25"
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
