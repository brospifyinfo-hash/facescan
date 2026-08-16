"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Scan, User } from "lucide-react";
import { useT } from "@/lib/i18n";

// The bottom navigation from the reference.
//
// A NOTE ON THE ONE THAT WAS REMOVED. The report page used to carry a
// floating tab bar and it was taken out on request — it fought with the
// report's own scroll and duplicated navigation that was already on the page.
// This is a different bar on a different page: the home screen is the top of
// the app, has nowhere else to put the four destinations, and the reference
// puts them here. It is not rendered on /results.
//
// Fixed rather than sticky, and the page reserves the space with padding, so
// the last card is never hidden under it.

export function HomeTabBar() {
  const t = useT();
  const pathname = usePathname();

  const items = [
    { href: "/", icon: Home, label: t.home.tabs.home },
    { href: "/quiz", icon: Scan, label: t.home.tabs.scan },
    { href: "/results", icon: BarChart3, label: t.home.tabs.analysis },
    { href: "/konto", icon: User, label: t.home.tabs.profile },
  ];

  return (
    <nav
      aria-label={t.home.tabsLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-hairline)] bg-[var(--color-surface)]/95 backdrop-blur-xl"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch justify-between px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-3 sm:max-w-2xl">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-1 rounded-[var(--r-control)] py-1.5"
              >
                <item.icon
                  className={`h-5 w-5 sm:h-[22px] sm:w-[22px] ${
                    active ? "text-[var(--color-accent)]" : "text-[var(--color-ink-tertiary)]"
                  }`}
                  aria-hidden
                />
                <span
                  className={`text-[11px] font-medium sm:text-[12px] ${
                    active ? "text-[var(--color-accent)]" : "text-[var(--color-ink-tertiary)]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
