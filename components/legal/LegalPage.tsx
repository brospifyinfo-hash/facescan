import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { LEGAL_UPDATED } from "@/lib/legal";

// Der gemeinsame Rahmen der vier Rechtsseiten.
//
// Sie sind bewusst nicht übersetzt und laufen nicht über lib/i18n. Ein
// Impressum und eine Widerrufsbelehrung sind keine Oberflächentexte, sondern
// der Vertragstext selbst; eine Übersetzung daneben zu stellen heißt, vier
// Fassungen zu pflegen, von denen im Streitfall eine gilt und die anderen
// erklärt werden müssen. Deutsch ist die Sprache des Anbieters und des
// Vertrags — dabei bleibt es, bis es einen Grund gibt, das zu ändern.
//
// Schmale Spalte, ruhige Typografie, keine Glaseffekte: das hier wird
// gelesen, nicht bestaunt.

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 pb-24 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-ink-tertiary)] transition-colors hover:text-[var(--color-ink-secondary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Zur Startseite
      </Link>

      <div className="mt-7">
        <Logo height={22} className="opacity-80" />
      </div>

      <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-ink)]">
        {title}
      </h1>
      {intro ? (
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-secondary)]">
          {intro}
        </p>
      ) : null}

      <div className="mt-9 flex flex-col gap-8">{children}</div>

      <p className="mt-12 border-t border-white/[0.07] pt-5 text-[11.5px] text-[var(--color-ink-quaternary)]">
        Stand: {LEGAL_UPDATED}
      </p>
    </main>
  );
}

/** Ein nummerierter Abschnitt. Die Nummer ist optional — das Impressum hat
 *  keine, die AGB brauchen sie, weil man sich auf Ziffern beruft. */
export function Section({
  n,
  title,
  children,
}: {
  n?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
        {n !== undefined ? `${n}. ` : ""}
        {title}
      </h2>
      <div className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink-secondary)]">
        {children}
      </div>
    </section>
  );
}

/** Adressblock, Musterformular, alles was als Block stehen bleiben soll. */
export function Block({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-[13.5px] leading-relaxed text-[var(--color-ink-secondary)]">
      {children}
    </div>
  );
}

/** Aufzählung mit den Abständen der Fließtexte ringsum. */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-[var(--color-ink-quaternary)]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
