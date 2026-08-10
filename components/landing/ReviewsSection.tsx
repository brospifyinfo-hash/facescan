import { Quote } from "lucide-react";
import { REVIEWS } from "@/lib/reviews";

// Renders nothing until real reviews exist in lib/reviews.ts — see the
// legal note there. Never ship invented testimonials.
export function ReviewsSection() {
  if (REVIEWS.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-24">
      <h2 className="text-center text-3xl font-semibold tracking-tight">
        What users say
      </h2>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {REVIEWS.map((r) => (
          <figure key={r.author} className="surface p-6">
            <Quote className="h-5 w-5 text-accent" aria-hidden />
            <blockquote className="mt-4 text-sm leading-relaxed text-[var(--color-ink-secondary)]">
              “{r.quote}”
            </blockquote>
            <figcaption className="mt-4 text-xs font-medium text-[var(--color-ink-tertiary)]">
              {r.author}
              {r.source ? ` · ${r.source}` : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
