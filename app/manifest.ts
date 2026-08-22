import type { MetadataRoute } from "next";
import { BRAND, SITE_URL } from "@/lib/seo";

// The web manifest.
//
// Two reasons it exists, neither of them "because PWAs are nice":
//
//   1. Google reads name/short_name/description when it renders the site
//      name and icon in mobile results. Without a manifest that name is
//      inferred from the <title>, which is a sentence, not a brand.
//   2. Added to a phone home screen — the single most likely way anyone
//      returns to a scan — it opens standalone on the brand colour instead
//      of in a browser chrome with a grey bar.
//
// The icons are the ones app/icon.png and app/apple-icon.png already serve,
// so there is no second set of assets to keep in sync.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND} — KI-Gesichtsanalyse`,
    short_name: BRAND,
    description:
      "Kostenlose KI-Gesichtsanalyse: 15 echte Messwerte, dein Score und ein konkreter Plan.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05080d",
    theme_color: "#05080d",
    lang: "de",
    dir: "ltr",
    categories: ["health", "lifestyle", "utilities"],
    icons: [
      { src: `${SITE_URL}/icon.png`, sizes: "any", type: "image/png", purpose: "any" },
      { src: `${SITE_URL}/apple-icon.png`, sizes: "180x180", type: "image/png" },
    ],
  };
}
