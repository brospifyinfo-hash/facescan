import { de } from "@/lib/i18n/de";
import { AMOUNTS, PLAN_ORDER } from "@/lib/pricing";
import { META_DESCRIPTION, visionPrivacy } from "@/lib/i18n/privacy";
import { BRAND, SITE_URL, absolute } from "@/lib/seo";

// Structured data — the part of SEO that changes what a result LOOKS like
// rather than merely where it ranks.
//
// Four graphs, each earning its place:
//
//   Organization      who is behind this, so the brand can consolidate into
//                     one entity instead of being guessed at per page
//   WebSite           names the site and its language
//   SoftwareApplication  with a real price for each tier. This is what can
//                     surface a price in the result itself, and it is the
//                     single highest-value item here for a paid product.
//   FAQPage           built FROM THE PAGE'S OWN FAQ, not written twice.
//
// EVERY CLAIM HERE IS ALSO ON THE PAGE. That is not a style preference: a
// FAQPage whose questions do not appear in the rendered HTML is a
// structured-data violation, and invented aggregateRatings are the reason
// review snippets get manually penalised. This product has no ratings, so
// none are declared — the same rule the reviews section already follows.
//
// A SERVER COMPONENT on purpose: this markup is for crawlers, and a crawler
// that does not run JavaScript still has to find it in the HTML.

// Must match components/landing/LandingPage.tsx, which swaps this one
// answer when the vision engine is live. Structured data that contradicts
// the rendered page is the exact violation the note above describes, so the
// override is applied here too rather than assumed away.
const PHOTO_FAQ_INDEX = 2;

export function JsonLd() {
  const t = de;
  const priv = visionPrivacy("de");

  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: BRAND,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: absolute("/logo-malook.d9990463.webp"),
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: BRAND,
      inLanguage: "de-DE",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: BRAND,
      applicationCategory: "HealthApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      // The same description the <head> carries: one sentence about this
      // product, not two that disagree.
      description: META_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      featureList: t.landing.pricingIncludes,
      // One offer per tier, with the price actually charged. The free scan
      // is stated as its own offer because "free scan, paid detail" is the
      // whole proposition and a result that hides it undersells the click.
      offers: [
        {
          "@type": "Offer",
          name: "Gratis-Scan",
          price: "0",
          priceCurrency: "EUR",
          description: t.landing.pricingNote,
        },
        ...PLAN_ORDER.map((plan) => ({
          "@type": "Offer",
          name: t.plans[plan].name,
          price: AMOUNTS[plan].toFixed(2),
          priceCurrency: "EUR",
          description: t.plans[plan].tagline,
          availability: "https://schema.org/InStock",
        })),
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      inLanguage: "de-DE",
      mainEntity: t.landing.faq.map((item, i) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: priv && i === PHOTO_FAQ_INDEX ? priv.faq : item.a,
        },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // The content is built from our own dictionary and price table — no
      // user input reaches it — and JSON.stringify escapes the rest.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
