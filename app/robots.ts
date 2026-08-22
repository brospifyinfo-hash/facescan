import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { FUNNEL_PATHS, PRIVATE_PATHS, SITE_HOST, absolute } from "@/lib/seo";

// robots.txt, generated rather than committed as a file — because the right
// answer depends on WHICH HOSTNAME is being asked.
//
// The same deployment answers on the apex, the www and a vercel.app URL, and
// a crawler that finds the site three times treats it as three sites: the
// ranking splits, and the copy Google happens to prefer may be the one with
// the machine-generated hostname. The canonical link says which one counts;
// this says the other two should not be crawled at all, which is the part
// that also stops them appearing in the first place.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? SITE_HOST;
  const canonicalHost = host === SITE_HOST;

  if (!canonicalHost) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces, and the funnel pages that only mean anything
        // with a scan in memory — a crawler landing on /results gets a
        // redirect to /upload, which is a thin page pretending to be a
        // destination.
        disallow: [...PRIVATE_PATHS, ...FUNNEL_PATHS],
      },
      {
        // The AI crawlers get the same answer as everyone else: this is a
        // public product page. Listed explicitly so the decision is visible
        // rather than inherited.
        userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"],
        allow: "/",
        disallow: [...PRIVATE_PATHS, ...FUNNEL_PATHS],
      },
    ],
    sitemap: absolute("/sitemap.xml"),
    host: SITE_HOST,
  };
}
