// Everything the search engines and social cards are told, in one place.
//
// ONE CANONICAL ORIGIN. The same deployment answers on three hostnames —
// the apex, the www and the vercel.app one — and to a crawler that is three
// copies of the same site competing with each other. Every canonical link,
// every sitemap entry and every share card points at exactly one of them;
// robots.ts additionally tells the other two not to index at all.
//
// THE INDEXED LANGUAGE IS GERMAN, deliberately. The dictionary is chosen in
// the browser, so the server can only render one language into the HTML a
// crawler reads — and the market this domain serves is the German one.
// Foreign visitors still get their own language the moment the app mounts;
// what changed is which of the four a search engine gets to see.

export const SITE_URL = "https://www.malookai.com";
export const SITE_HOST = "www.malookai.com";

/** The name on the logo and the domain — not the repository's own name. */
export const BRAND = "Malook";
export const SITE_LOCALE = "de_DE";

/** Paths a search engine has no business indexing, and why. */
export const PRIVATE_PATHS = [
  "/admin", // the owner's cockpit
  "/konto", // one person's account
  "/api", // machine endpoints
];

/**
 * Paths that exist for a person mid-funnel and mean nothing to a visitor
 * arriving cold: they need a scan in memory and render an empty or
 * redirecting screen without one.
 */
export const FUNNEL_PATHS = ["/scan", "/results", "/upload", "/calibrate"];

export const absolute = (path = "/") => `${SITE_URL}${path === "/" ? "" : path}`;
