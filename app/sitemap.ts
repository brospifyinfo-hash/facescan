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
  ];
}
