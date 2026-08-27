"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { fetchUser, type SessionUser } from "@/lib/auth/client";
import { useT } from "@/lib/i18n";

// The top-right of the home screen: who you are, or the way to say so.
//
// It replaced a pill that read "Confidential" — a property of the page,
// stated to nobody in particular, in the one spot on the screen where an
// app puts the person using it. Signed in it shows the picture and the
// name and leads to the profile; signed out it is the login.

export function AccountChip() {
  const t = useT();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    void fetchUser().then(setUser);
  }, []);

  useEffect(() => {
    load();
    // Coming back from another tab is the common way a sign-in happens
    // elsewhere; re-checking on focus keeps this chip from lying.
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  if (!user) {
    return (
      <>
        {/* DAS GOOGLE-G STATT EINES GENERISCHEN TUERSYMBOLS.
            Vorher stand hier ein Icon aus derselben Strichsammlung wie alles
            andere — es sagte "hier kann man sich anmelden", was ohnehin schon
            danebenstand. Die Frage, die ein neuer Besucher an dieser Stelle
            wirklich hat, ist "muss ich mir ein weiteres Passwort ausdenken?".
            Eine wiedererkennbare Marke beantwortet sie in einer Fuenftelsekunde;
            ein Tuersymbol beantwortet sie gar nicht.

            Auf weisser Scheibe, weil Googles Richtlinien das Mal so
            vorsehen: ein eigener Knopf ist erlaubt, ein eingefaerbtes Logo
            nicht. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="interactive flex shrink-0 items-center gap-2.5 rounded-full border border-[var(--color-hairline)] bg-white/[0.03] py-1.5 pl-4 pr-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--color-ink-secondary)] transition-colors hover:border-white/25 hover:text-[var(--color-ink)] sm:text-[12.5px]"
        >
          {t.home.login}
          <span
            aria-hidden
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:h-[28px] sm:w-[28px]"
          >
            <GoogleMark size={15} />
          </span>
        </button>

        <AuthModal
          open={open}
          start="login"
          onClose={() => setOpen(false)}
          onSignedIn={() => {
            setOpen(false);
            load();
            // Already home — refresh so the page greets the person who
            // just arrived rather than the visitor they were a second ago.
            router.refresh();
          }}
        />
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push("/konto")}
      className="interactive flex min-w-0 shrink items-center gap-2 rounded-full border border-[var(--color-hairline)] py-1.5 pl-1.5 pr-3 hover:border-white/25"
    >
      <Avatar user={user} />
      <span className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--color-ink)] sm:text-[13.5px]">
        {user.name}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-tertiary)]" aria-hidden />
    </button>
  );
}

/** The picture when there is one, the first letter when there is not — a
 *  stock silhouette would be a picture of nobody. */
export function Avatar({ user, size = 30 }: { user: SessionUser; size?: number }) {
  const [failed, setFailed] = useState(false);
  const show = user.picture && !failed;
  return show ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.picture as string}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-deep)] font-bold uppercase text-[var(--color-accent)]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(user.name || user.email)[0]}
    </span>
  );
}
