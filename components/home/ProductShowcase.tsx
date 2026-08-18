"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Droplets,
  Heart,
  Leaf,
  Scan,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  Wind,
} from "lucide-react";
import {
  categoryMatches,
  purposeAndBenefit,
  PRODUCT_CATEGORIES,
  type CategoryId,
} from "@/lib/products/presentation";
import type { Product } from "@/lib/products/types";
import { useT } from "@/lib/i18n";

// The product rail on the home page.
//
// IT SHOWS THE REAL CATALOGUE. /api/products serves what is in the
// spreadsheet; nothing here invents a product, and when the catalogue is
// empty the whole block renders nothing rather than showing placeholders that
// cannot be bought.
//
// WHAT THE REFERENCE HAD AND THIS DOES NOT, AND WHY
//
//   PRICES — removed from the product model on request ("die preise bitte
//   komplett entfernen"). They are not stored, so there is nothing to show.
//
//   STAR RATINGS — "4.8 (1.2k)" is social proof, and we hold no ratings. A
//   number invented for the card is a fabricated review, which is the one
//   thing this product has consistently refused to do.
//
//   "BESTSELLER" — we do not know what sells. The badge that IS real is the
//   match: the first card is the strongest fit for this scan, and "Neu" is
//   read off the product's own createdAt.
//
// The heart is a real favourite, kept in localStorage. A decorative heart
// that does nothing is worse than no heart.

const FAV_KEY = "facescan.favourites";

const CATEGORY_ICONS = {
  all: User,
  skin: Droplets,
  face: Scan,
  hair: Wind,
  lifestyle: Heart,
} as const;

const TRUST_ICONS = [ShieldCheck, Target, Leaf, Sparkles];

/** Newer than this and the card says so. Two weeks, read off real data. */
const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

export function ProductShowcase({
  /** Already ranked when there is a scan; catalogue order otherwise. */
  products,
}: {
  products: Product[];
}) {
  const t = useT();
  const [category, setCategory] = useState<CategoryId>("all");
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAV_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setFavourites(parsed.filter((x) => typeof x === "string"));
    } catch {
      // A corrupt value is a list of hearts, not an account.
    }
  }, []);

  const toggleFavourite = (id: string) => {
    setFavourites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        // Private mode. The heart still works for this session.
      }
      return next;
    });
  };

  const shown = useMemo(
    () => products.filter((p) => categoryMatches(category, p.tags)),
    [products, category],
  );

  // An empty catalogue is a real state — the owner has not added anything
  // yet — and an empty rail with a heading is worse than no rail.
  if (products.length === 0) return null;

  return (
    <>
      {/* ---- Recommendations ------------------------------------------- */}
      <section className="border-t border-[var(--color-hairline)] pt-6 sm:pt-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)] sm:text-[13.5px]">
              <Sparkles className="h-4 w-4 shrink-0 text-[var(--color-accent)] sm:h-[18px] sm:w-[18px]" aria-hidden />
              {t.home.products.title}
            </h2>
            <p className="mt-2 max-w-[46ch] text-[12.5px] leading-[1.5] text-[var(--color-ink-secondary)] sm:text-[14px]">
              {t.home.products.sub}
            </p>
          </div>
          <Link
            href="/results"
            className="interactive flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-accent)]/40 bg-[var(--color-accent-deep)]/60 px-3 py-2 text-[11px] font-medium text-[var(--color-accent)] sm:text-[12.5px]"
          >
            {t.home.products.seeAll}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {/* The filter rail. Scrolls sideways rather than wrapping, so the
            block keeps its height whatever the language does to the words. */}
        <div className="mt-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max gap-2">
            {PRODUCT_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id];
              const active = category === cat.id;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    aria-pressed={active}
                    className={`interactive flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[11.5px] font-medium transition-colors sm:text-[13px] ${
                      active
                        ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                        : "border border-white/[0.11] bg-white/[0.04] text-[var(--color-ink-secondary)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {t.home.products.categories[cat.id]}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* The cards. A scroll-snapped rail — two and a bit visible on a
            phone, which is what tells the reader there are more. */}
        {shown.length === 0 ? (
          <p className="mt-5 text-[12.5px] text-[var(--color-ink-tertiary)]">
            {t.home.products.emptyCategory}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ul className="flex w-max snap-x snap-mandatory gap-3">
              {shown.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  best={i === 0 && category === "all"}
                  favourite={favourites.includes(product.id)}
                  onToggleFavourite={() => toggleFavourite(product.id)}
                />
              ))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-[var(--color-ink-quaternary)] sm:text-[11px]">
          {t.products.disclosure}
        </p>
      </section>

      {/* ---- Why these ------------------------------------------------- */}
      <section className="grid grid-cols-2 gap-y-6 border-t border-[var(--color-hairline)] pt-6 sm:grid-cols-4 sm:pt-7">
        {t.home.products.trust.map((item, i) => {
          const Icon = TRUST_ICONS[i];
          return (
            <div
              key={i}
              className={`flex flex-col items-center px-2 text-center ${
                i % 2 === 1 ? "border-l border-white/[0.08]" : ""
              } ${i > 0 ? "sm:border-l sm:border-white/[0.08]" : "sm:border-l-0"}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.04] sm:h-12 sm:w-12">
                <Icon className="h-[18px] w-[18px] text-[var(--color-accent)] sm:h-5 sm:w-5" aria-hidden />
              </span>
              <p className="mt-2.5 text-[11.5px] font-semibold text-[var(--color-ink)] sm:text-[13px]">
                {item.title}
              </p>
              <p className="mt-1 text-[10px] leading-[1.35] text-[var(--color-ink-tertiary)] sm:text-[11.5px]">
                {item.text}
              </p>
            </div>
          );
        })}
      </section>
    </>
  );
}

function ProductCard({
  product,
  best,
  favourite,
  onToggleFavourite,
}: {
  product: Product;
  best: boolean;
  favourite: boolean;
  onToggleFavourite: () => void;
}) {
  const t = useT();
  const copy = purposeAndBenefit(t, product.tags);
  const isNew = Date.now() - product.createdAt < NEW_FOR_MS;
  const host = hostOf(product.affiliateLink);

  return (
    <li className="w-[210px] shrink-0 snap-start sm:w-[240px]">
      {/* A product tile is a control (it links out), so it keeps the thin
          outline — the same affordance as a quiz option. */}
      <article className="flex h-full flex-col overflow-hidden rounded-[var(--r-card)] border border-white/[0.08] bg-white/[0.02]">
        <div className="relative aspect-square w-full overflow-hidden">
          {/* The halo behind the shot, as in the reference. Drawn rather than
              expected from the image, because a product photo from a
              merchant arrives on whatever background it arrives on. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 55%, rgba(95,227,138,0.22), transparent 70%)",
            }}
          />
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="relative h-full w-full object-contain p-5"
            />
          ) : (
            <div className="relative flex h-full items-center justify-center">
              <Sparkles className="h-7 w-7 text-[var(--color-ink-quaternary)]" aria-hidden />
            </div>
          )}

          {best || isNew ? (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--color-accent-deep)] px-2 py-1 text-[9.5px] font-semibold text-[var(--color-accent)] sm:text-[10.5px]">
              {best ? t.home.products.bestMatch : t.home.products.isNew}
            </span>
          ) : null}

          <button
            type="button"
            onClick={onToggleFavourite}
            aria-pressed={favourite}
            aria-label={t.home.products.favourite}
            className="interactive absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 backdrop-blur-md"
          >
            <Heart
              className={`h-4 w-4 ${
                favourite
                  ? "fill-[var(--color-accent)] text-[var(--color-accent)]"
                  : "text-white/70"
              }`}
              aria-hidden
            />
          </button>
        </div>

        <div className="flex flex-1 flex-col p-3.5">
          <h3 className="text-[13.5px] font-semibold leading-tight text-[var(--color-ink)] sm:text-[15px]">
            {product.title}
          </h3>

          {copy ? (
            <dl className="mt-2.5 space-y-2">
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-quaternary)] sm:text-[10px]">
                  {t.home.products.purposeLabel}
                </dt>
                <dd className="mt-0.5 text-[11.5px] leading-[1.35] text-[var(--color-ink-secondary)] sm:text-[12.5px]">
                  {copy.purpose}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] sm:text-[10px]">
                  {t.home.products.benefitLabel}
                </dt>
                <dd className="mt-0.5 text-[11.5px] leading-[1.35] text-[var(--color-ink-secondary)] sm:text-[12.5px]">
                  {copy.benefit}
                </dd>
              </div>
            </dl>
          ) : (
            // No tags on the product: fall back to whatever the admin typed
            // rather than leaving the card half empty.
            <p className="mt-2 text-[11.5px] leading-[1.4] text-[var(--color-ink-secondary)]">
              {product.description}
            </p>
          )}

          <a
            href={product.affiliateLink}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="interactive mt-auto flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-accent)] pt-2.5 pb-2.5 text-[11.5px] font-semibold text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)] sm:text-[12.5px]"
            style={{ marginTop: "14px" }}
          >
            {host ? t.products.cta.replace("{host}", host) : t.products.ctaGeneric}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </article>
    </li>
  );
}

/** The merchant, read off the link, so the button says where it goes. */
function hostOf(link: string): string | null {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
