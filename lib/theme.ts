// Brand colours, for the code that cannot read a CSS variable.
//
// WHY THIS FILE EXISTS
// --------------------
// Most of the interface takes its colour from the tokens in globals.css.
// Three places cannot:
//
//   * SVG PRESENTATION ATTRIBUTES. `stroke="var(--color-accent)"` does not
//     resolve — presentation attributes are not CSS declarations. It only
//     works from a stylesheet or a style attribute, and the charts here set
//     stroke and fill per element from computed data.
//   * STRIPE ELEMENTS. Its appearance API is configured in JS and needs
//     literal hex; it never sees the page's stylesheet.
//   * HTML EMAIL. lib/auth/email.ts renders into a mail client, where
//     custom properties are unsupported.
//
// Those three used to carry their own copies of #95BF47. When the accent
// moved with the design update, the CSS changed and the copies did not, so
// the page ran two different greens at once — the ring one shade, the
// button another. That is the whole failure mode this file removes.
//
// globals.css still declares the same values for the CSS side; the two are
// held together by a test rather than by memory (scripts/test-theme.mts).

export const BRAND = {
  /** Primary action tint. The one colour allowed to mean "do this". */
  accent: "#9ecb4f",
  accentBright: "#b4de69",
  accentPress: "#85ae3f",
  /** Text and icons placed ON the accent. */
  accentInk: "#0a0a0b",

  canvas: "#0a0a0b",
  surface: "#131316",
  surfaceRaised: "#1a1a1f",

  ink: "#f5f5f7",
  inkSecondary: "#a1a1a8",
  inkTertiary: "#6e6e76",

  /** Out-of-range readings. Amber, never red: a measurement outside a
   *  reference band is unusual, not an error, and red says "you are broken". */
  caution: "#e0a33c",

  /** Neutral track behind any filled arc or bar. */
  track: "rgba(255,255,255,0.08)",
} as const;

/** Alpha variant of a brand hex, for glows and fills. `a` is 0–1. */
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${v}`;
}
