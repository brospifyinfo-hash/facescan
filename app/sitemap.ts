import type { MetadataRoute } from "next";
import { absolute } from "@/lib/seo";

// The sitemap lists what a stranger can actually land on and understand.
//
// It is deliberately SHORT. A sitemap is not an inventory of routes: adding
// /results or /scan would submit pages that redirect away without a scan in
// memory, and submitting pages that bounce is how a small site teaches a
// crawler to trust it less.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: absolute("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      // The quiz is a real entry point: it renders on its own, needs
      // nothing in memory, and is where a search visitor should start.
      url: absolute("/quiz"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      // The partner programme's explainer. It renders for a stranger — the
      // signed-out state is the pitch, not a login wall — so it passes the
      // same test the quiz does.
      //
      // Lower priority than the home page on purpose: it recruits partners
      // rather than customers, so it should never outrank the page the
      // product is actually sold on. The signed-in dashboard behind the same
      // path sets its own robots meta; that is a rendering decision the page
      // makes, and nothing this file can express.
      url: absolute("/partner"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      // Contact. It renders for a stranger and needs nothing in memory, so
      // it passes the same test the quiz does — and "how do I reach them"
      // is a question people put to a search engine before they put it to
      // the company. Lowest priority of the four: it is the page somebody
      // looks for by name, never the one that should win a product query.
      url: absolute("/support"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
