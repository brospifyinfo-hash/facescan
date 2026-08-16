// The pictures on the home page that the owner can swap without a deploy.
//
// TWO SLOTS, NOT AN UPLOAD FOLDER. A named slot has a place in the layout, a
// known aspect ratio and a default that already looks right — so an empty
// slot is a designed state rather than a hole. A general media library would
// mean the page has to cope with any image in any shape, which is how a
// landing page ends up looking different every time someone touches it.
//
// EVERY SLOT SHIPS WITH A DEFAULT. public/hero-mesh.svg and the tip chart are
// generated assets committed to the repo, so a fresh deployment with nothing
// configured renders the design as drawn. The admin overrides are exactly
// that — overrides.
//
// STORED IN THE SHEETS KV, so a change survives a deploy and the owner can
// see the current value in the spreadsheet. Two URLs is not worth a tab of
// its own.

export const IMAGE_SLOTS = ["hero", "tip"] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number];

export interface SlotSpec {
  /** Shown in the admin as the field label. */
  label: string;
  /** What it is and where it appears, so the owner picks a sane picture. */
  hint: string;
  /** Shipped asset used until an override is set. */
  fallback: string;
  /** Rendered aspect, for the admin preview. */
  aspect: string;
}

export const SLOT_SPECS: Record<ImageSlot, SlotSpec> = {
  hero: {
    label: "Hero-Grafik",
    hint: "Die Drahtgitter-Grafik rechts im obersten Block. Transparenter Hintergrund, hochkant, grün auf Dunkel.",
    fallback: "/hero-mesh.svg",
    aspect: "3 / 4",
  },
  tip: {
    label: "Tipp-Grafik",
    hint: "Der Verlauf im Block „Tipp des Tages“. Transparenter Hintergrund, quer.",
    fallback: "/tip-chart.svg",
    aspect: "16 / 9",
  },
};

export type SiteImages = Partial<Record<ImageSlot, string>>;

export const isImageSlot = (v: unknown): v is ImageSlot =>
  typeof v === "string" && (IMAGE_SLOTS as readonly string[]).includes(v);

/**
 * What may be stored as a slot value.
 *
 * An absolute http(s) URL or a site-relative path, and nothing else. The
 * value is written straight into `src`, so without this a `javascript:` URL
 * pasted into the admin becomes script on the landing page — the admin is
 * code-gated, but "only an admin can do it" is not a reason to leave the hole
 * open, and the same field will accept whatever a future upload path returns.
 *
 * Returns the cleaned value, or null if it may not be stored.
 */
export function cleanImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0) return null;
  if (value.length > 2048) return null;

  // Site-relative, e.g. the shipped defaults. Must not be protocol-relative
  // (`//evil.example`), which the browser reads as an absolute URL.
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** Drop anything unknown or unusable rather than storing it. */
export function cleanSiteImages(raw: unknown): SiteImages {
  const out: SiteImages = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isImageSlot(key)) continue;
    const url = cleanImageUrl(value);
    if (url) out[key] = url;
  }
  return out;
}

/** The URL to render: the override when there is one, the shipped asset otherwise. */
export function resolveSlot(images: SiteImages, slot: ImageSlot): string {
  return images[slot] ?? SLOT_SPECS[slot].fallback;
}
