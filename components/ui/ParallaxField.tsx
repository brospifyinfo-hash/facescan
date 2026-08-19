"use client";

import { useEffect, useRef } from "react";

// The moving half of the ambient light. See the PARALLAX LIGHT note in
// globals.css: the body's four static colour fields are the base the glass
// refracts, and these ride above them at different depths, so scrolling
// shifts the light the way a room shifts behind a window.
//
// WHY A LISTENER AND NOT A rAF LOOP. A continuous loop burns a frame budget
// doing nothing while the page is still — and on this machine's preview it
// would also LOOK broken, because a hidden pane produces no frames at all
// (see the Browser-Pane note in the project memory). Scroll events schedule
// exactly one frame each; a still page costs nothing.
//
// The script writes ONE number (--scroll-y). The per-layer factors live in
// CSS custom properties on the blobs, so depth is tuned in markup, and a
// reduced-motion media query can switch the whole effect off without ever
// asking JavaScript.

type Blob = {
  /** CSS inset — where the light hangs in the viewport. */
  style: React.CSSProperties;
  /** Scroll factor. Negative drifts up as the page scrolls down. */
  depth: number;
};

// Positions are offset from the four static fields, so the moving light
// layers WITH the standing light instead of doubling it. Alphas are low:
// these add to an ambience that already exists.
// THESE ARE THE SITE'S COLOUR FIELDS — the quiz's beloved glow, owned by
// this layer since the body background failed on long pages (see the note
// in globals.css). Alphas at the original body strength, sizes with a vmin
// floor so a phone is filled, positions in viewport terms.
//
// The depths mix directions on purpose. All-negative factors would empty
// the viewport by the bottom of a long page (every field having drifted
// up and away); a slow positive drift plus two fields that START below the
// fold and rise into view keeps every scroll position lit — and two fields
// crossing each other is the strongest parallax cue there is.
const BLOBS: Blob[] = [
  {
    // The quiz's top-left green, drifting down slowly: stays with the top.
    depth: 0.04,
    style: {
      left: "-6%",
      top: "-8%",
      width: "max(46vw, 68vmin)",
      height: "max(46vw, 68vmin)",
      background:
        "radial-gradient(closest-side, rgba(95, 227, 138, 0.26), transparent 70%)",
    },
  },
  {
    // The blue, rising gently.
    depth: -0.09,
    style: {
      right: "-10%",
      top: "10%",
      width: "max(52vw, 74vmin)",
      height: "max(52vw, 74vmin)",
      background:
        "radial-gradient(closest-side, rgba(56, 152, 255, 0.18), transparent 72%)",
    },
  },
  {
    // The lower green — the near layer, rising fastest.
    depth: -0.16,
    style: {
      left: "58%",
      top: "72%",
      width: "max(46vw, 66vmin)",
      height: "max(46vw, 66vmin)",
      background:
        "radial-gradient(closest-side, rgba(95, 227, 138, 0.15), transparent 70%)",
    },
  },
  {
    // The violet, mid depth.
    depth: -0.06,
    style: {
      left: "-4%",
      top: "52%",
      width: "max(40vw, 58vmin)",
      height: "max(40vw, 58vmin)",
      background:
        "radial-gradient(closest-side, rgba(132, 104, 255, 0.14), transparent 70%)",
    },
  },
  {
    // Starts one viewport below the fold and rises in as the page scrolls —
    // the light that keeps the middle of a long page from going black.
    depth: -0.12,
    style: {
      left: "24%",
      top: "115%",
      width: "max(56vw, 80vmin)",
      height: "max(56vw, 80vmin)",
      background:
        "radial-gradient(closest-side, rgba(56, 200, 190, 0.13), transparent 72%)",
    },
  },
  {
    // And one more from far below, for the tail of the page — deep enough
    // that ~4500px of scroll actually carries it into view.
    depth: -0.2,
    style: {
      left: "52%",
      top: "190%",
      width: "max(48vw, 70vmin)",
      height: "max(48vw, 70vmin)",
      background:
        "radial-gradient(closest-side, rgba(132, 104, 255, 0.12), transparent 70%)",
    },
  },
];

export function ParallaxField() {
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    // The CSS transform is also disabled under this query; skipping the
    // listener as well means a still preference costs zero work.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--scroll-y", String(window.scrollY));
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={strip} aria-hidden className="parallax-strip">
      {BLOBS.map((blob, i) => (
        <div
          key={i}
          className="parallax-blob"
          style={{ ...blob.style, "--depth": blob.depth } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
