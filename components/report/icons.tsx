// The eight analysis glyphs.
//
// Hand-drawn rather than pulled from the icon library, for one reason: there
// is no lucide glyph for "gonial angle" or "midface ratio", so half the row
// would end up on a stand-in — a generic ruler standing for proportions, a
// generic droplet standing for skin — and a row where half the icons are
// literal and half are metaphors reads as a row of clip-art.
//
// One geometry for all eight: 24×24, 1.4 stroke, round caps, no fill, colour
// inherited. They are LABELS, not illustrations; each one only has to be
// distinguishable from the other seven at 16px.

type IconProps = { className?: string };

function Glyph({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Symmetry — a mirror axis with matched marks either side. */
export function IconSymmetry(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M12 3v18" strokeDasharray="2.5 2.5" />
      <path d="M8.5 7.5 4 12l4.5 4.5" />
      <path d="M15.5 7.5 20 12l-4.5 4.5" />
    </Glyph>
  );
}

/** Jawline — the lower-third outline, tapering to the chin. */
export function IconJaw(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M5 5v5.5c0 4.4 3.1 8 7 8s7-3.6 7-8V5" />
      <path d="M8.5 12.5c1.2 1.6 5.8 1.6 7 0" />
    </Glyph>
  );
}

/** Skin — surface, read as texture rather than as a water droplet. */
export function IconSkin(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M8.4 9.6h.01M12.6 8.4h.01M15.6 11.4h.01M9.6 14.4h.01M13.4 14.8h.01" />
    </Glyph>
  );
}

/** Eye region — fissure with the iris, not a stylised almond. */
export function IconEyes(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M2.8 12c2.4-3.6 5.5-5.4 9.2-5.4s6.8 1.8 9.2 5.4c-2.4 3.6-5.5 5.4-9.2 5.4S5.2 15.6 2.8 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </Glyph>
  );
}

/** Nose — the profile from nasion to subnasale, with the alar base. */
export function IconNose(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M12 3.5v5.2c0 1.6-2.6 4.4-2.6 6.4a2.6 2.6 0 0 0 5.2 0c0-2-2.6-4.8-2.6-6.4" />
      <path d="M8 17.6c1.1.9 6.9.9 8 0" />
    </Glyph>
  );
}

/** Lips — upper and lower vermilion, split by the mouth line. */
export function IconLips(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M3.4 12c2-2.6 4-3.9 6-3.9 1 0 1.8.4 2.6 1.1.8-.7 1.6-1.1 2.6-1.1 2 0 4 1.3 6 3.9" />
      <path d="M3.4 12c2 2.6 4 3.9 6 3.9 1.7 0 3.2-.6 5.2-.6 2 0 4-1.1 6-3.3" />
      <path d="M3.4 12h17.2" />
    </Glyph>
  );
}

/** Proportions — the horizontal thirds across a bounded field. */
export function IconProportions(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="3.5" />
      <path d="M4.5 9.2h15M4.5 14.8h15" strokeDasharray="2.5 2.5" />
    </Glyph>
  );
}

/** Face shape — the oval with its two defining widths. */
export function IconFaceShape(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M12 3.2c3.9 0 6.6 2.8 6.6 7 0 5-3.2 10.6-6.6 10.6S5.4 15.2 5.4 10.2c0-4.2 2.7-7 6.6-7Z" />
      <path d="M6.2 9.4h11.6" strokeDasharray="2 2.4" />
      <path d="M8 15h8" strokeDasharray="2 2.4" />
    </Glyph>
  );
}

/** Strengths — the crown from the reference, in the same stroke as the rest. */
export function IconCrown(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M3 8.5l3.6 3.2L12 5.5l5.4 6.2L21 8.5l-2 9.2H5L3 8.5Z" />
    </Glyph>
  );
}

/** Optimisation — the bolt, the one glyph that carries the amber. */
export function IconBolt(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M13.2 2.5 4.5 13.6h6.1l-.8 7.9 8.7-11.1h-6.1l.8-7.9Z" />
    </Glyph>
  );
}

/** The tip card's lamp. */
export function IconBulb(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M9.2 17.5a6.2 6.2 0 1 1 5.6 0v1.8a1.6 1.6 0 0 1-1.6 1.6h-2.4a1.6 1.6 0 0 1-1.6-1.6v-1.8Z" />
      <path d="M9.6 17.6h4.8" />
    </Glyph>
  );
}

/** Scan id — a head inside a frame, the reference's badge glyph. */
export function IconScanId(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="3.4" y="4.2" width="17.2" height="15.6" rx="3" />
      <circle cx="9.6" cy="10.4" r="2.1" />
      <path d="M6.1 16.4c.7-1.9 2-2.8 3.5-2.8s2.8.9 3.5 2.8" />
      <path d="M15.4 9.4h3M15.4 12.6h3" />
    </Glyph>
  );
}

/** Date — the calendar, with the two rings the reference draws on top. */
export function IconCalendar(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="3.6" y="5.4" width="16.8" height="14.6" rx="3" />
      <path d="M3.6 9.8h16.8" />
      <path d="M8.4 3.4v3.4M15.6 3.4v3.4" />
    </Glyph>
  );
}

/** History — a clock with a counter-clockwise arrow, for the fourth tab. */
export function IconHistory(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1" />
      <path d="M3.4 4.2v4h4" />
      <path d="M12 7.6V12l3 1.8" />
    </Glyph>
  );
}

/** Header mark — the scan frame around a face, matching the viewfinder. */
export function IconScanMark(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M3.2 8.6V5.4a2.2 2.2 0 0 1 2.2-2.2h3.2" />
      <path d="M15.4 3.2h3.2a2.2 2.2 0 0 1 2.2 2.2v3.2" />
      <path d="M20.8 15.4v3.2a2.2 2.2 0 0 1-2.2 2.2h-3.2" />
      <path d="M8.6 20.8H5.4a2.2 2.2 0 0 1-2.2-2.2v-3.2" />
      <circle cx="9.6" cy="10.6" r="1" />
      <circle cx="14.4" cy="10.6" r="1" />
      <path d="M9.4 15.2c1.5 1.1 3.7 1.1 5.2 0" />
    </Glyph>
  );
}
