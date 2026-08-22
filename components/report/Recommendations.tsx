"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, Sparkles, Tag } from "lucide-react";
import { fill, useT } from "@/lib/i18n";
import { recommend, type Recommendations as Ranked } from "@/lib/products/match";
import { sharedRewardsCode } from "@/lib/products/rewards";
import { PLAN_FOR_TAG, type Product } from "@/lib/products/types";
import type { QuizAnswers, ScanMetrics } from "@/lib/store";
import { cn } from "@/lib/cn";

// The affiliate block.
//
// THE RANKING HAPPENS HERE, IN THE BROWSER. The catalogue is fetched; the
// scan is not sent. That is the whole reason match.ts is a pure function —
// see the note at the top of app/api/products/route.ts.
//
// TWO TIERS, AND THE DIFFERENCE IS STRUCTURAL, NOT DECORATIVE. The top three
// get a horizontal card with the image at reading size, the reason they were
// picked, and a filled button. The rest get a small grid tile. A user
// skimming should be able to tell which is which with the text unreadable.

export function Recommendations({
  quiz,
  metrics,
}: {
  quiz: QuizAnswers;
  metrics: ScanMetrics;
}) {
  const t = useT();
  const [ranked, setRanked] = useState<Ranked | null>(null);
  // The whole catalogue, not just what was recommended: the code is only
  // advertised when EVERY link carries it, and "every" has to mean every
  // product the customer can reach from here.
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) return;
        const data = (await res.json()) as { products: Product[] };
        if (cancelled) return;
        setRanked(recommend(data.products, quiz, metrics));
        setCode(sharedRewardsCode(data.products));
      } catch {
        // A catalogue that will not load is not worth an error state on a
        // report page. The section simply does not appear.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quiz, metrics]);

  // Nothing matched, or nothing loaded: render nothing at all. A heading over
  // an empty row reads as a broken feature.
  if (!ranked || ranked.top.length === 0) return null;

  return (
    <section id="products" className="scroll-mt-4">
      <h2 className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
        {t.products.title}
      </h2>

      <div className="grid gap-2.5">
        {ranked.top.map((entry, i) => (
          <TopCard key={entry.product.id} entry={entry} index={i} />
        ))}
      </div>

      {ranked.others.length > 0 ? (
        <>
          <h3 className="mb-2.5 mt-5 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-tertiary)]">
            {t.products.othersTitle}
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {ranked.others.map((entry) => (
              <SmallCard key={entry.product.id} entry={entry} />
            ))}
          </div>
        </>
      ) : null}

      {/* The discount code, shown ONLY when every link carries the same one.
          The paid tiers advertise it, so it has to be visible somewhere the
          customer can actually read and copy it — a code that exists solely
          inside a query string is a promise nobody can see being kept.

          What it is worth is deliberately not stated: iHerb owns those terms
          and can change them tomorrow. See lib/products/rewards.ts. */}
      {code ? <RewardsCode code={code} /> : null}

      {/* Not fine print by choice — a paid report that quietly earns a
          commission on what it recommends has to say so, and saying it
          plainly costs nothing. */}
      <p className="mt-4 px-1 text-[10.5px] leading-relaxed text-[var(--color-ink-quaternary)]">
        {t.products.disclosure}
      </p>
    </section>
  );
}

/**
 * The merchant discount code, copyable.
 *
 * Copy-to-clipboard rather than a decorative badge: the code is only useful
 * in iHerb's promo field, and retyping a random eight-character string off a
 * phone screen is exactly where a discount quietly stops being claimed.
 * Falls back to plain selectable text wherever the clipboard API is refused.
 */
function RewardsCode({ code }: { code: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/[0.06] px-3.5 py-3">
      <Tag className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-tertiary)]">
            {t.products.discountLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(code).then(
                () => setCopied(true),
                () => {},
              );
            }}
            className="interactive font-mono-terminal rounded-md bg-white/[0.07] px-2 py-0.5 text-[12.5px] font-bold tracking-[0.06em] text-[var(--color-accent)] hover:bg-white/[0.12]"
          >
            {code}
          </button>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" aria-hidden />
          ) : null}
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
          {t.products.discountNote}
        </p>
      </div>
    </div>
  );
}

/** "Auf amazon.de ansehen" — the merchant, from the link itself. */
function ctaLabel(t: ReturnType<typeof useT>, href: string): string {
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    return fill(t.products.cta, { host });
  } catch {
    return t.products.ctaGeneric;
  }
}

type Entry = Ranked["top"][number];

function TopCard({ entry, index }: { entry: Entry; index: number }) {
  const t = useT();
  const reduce = useReducedMotion();
  const { product, matched } = entry;

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : index * 0.07 }}
      className="panel panel-lit-accent relative overflow-hidden p-3"
      style={{
        borderColor: "rgba(95,227,138,0.28)",
        boxShadow:
          "inset 0 1px 0 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(95,227,138,0.06), 0 10px 40px rgba(0,0,0,0.25)",
      }}
    >
      <div className="relative flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt=""
          className="h-[84px] w-[84px] shrink-0 rounded-[14px] bg-white/[0.04] object-cover"
          loading="lazy"
          decoding="async"
        />

        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/[0.14] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-accent)]">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            {t.products.topBadge}
          </span>

          <h3 className="mt-1.5 text-[13.5px] font-semibold leading-tight text-[var(--color-ink)]">
            {product.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-[var(--color-ink-secondary)]">
            {product.description}
          </p>

          {/* Why this product, in the same words the plan uses. */}
          <p className="mt-1.5 text-[10.5px] text-[var(--color-ink-tertiary)]">
            {t.products.matchedFor}:{" "}
            {matched.slice(0, 2).map((tag) => t.plan[PLAN_FOR_TAG[tag]].short).join(" · ")}
          </p>
        </div>
      </div>

      {/* The call to action takes the whole row now that no price shares it.
          A price was a copy of the merchant's, went stale the moment they
          changed it, and put a number next to a recommendation that this shop
          does not charge. */}
      <a
        href={product.affiliateLink}
        target="_blank"
        // `sponsored` is the correct relationship for a paid link, and
        // noopener/noreferrer keep the opened tab from reaching back into
        // this one.
        rel="sponsored noopener noreferrer"
        className="relative mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--color-accent-ink)] transition-colors hover:bg-[var(--color-accent-bright)] active:scale-[0.98] motion-reduce:active:scale-100"
      >
        {ctaLabel(t, product.affiliateLink)}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </a>
    </motion.article>
  );
}

function SmallCard({ entry }: { entry: Entry }) {
  const { product } = entry;

  return (
    <a
      href={product.affiliateLink}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={cn(
        "panel interactive flex flex-col p-2.5",
        // No accent border, no badge, no filled button. The whole tile is the
        // control, which is what keeps it quiet next to the three above.
        "hover:border-white/15",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.imageUrl}
        alt=""
        className="mb-2 aspect-square w-full rounded-[12px] bg-white/[0.04] object-cover"
        loading="lazy"
        decoding="async"
      />
      <h4 className="line-clamp-2 text-[11.5px] font-medium leading-tight text-[var(--color-ink-secondary)]">
        {product.title}
      </h4>
      <span className="mt-auto flex items-center justify-end pt-1.5">
        <ArrowUpRight
          className="h-3.5 w-3.5 text-[var(--color-accent)]"
          aria-hidden
        />
      </span>
    </a>
  );
}
