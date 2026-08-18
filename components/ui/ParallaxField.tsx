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
// Sizes are min(vw, rem)-shaped via vmin so a phone gets fields that still
// fill a meaningful share of its viewport — pure vw made them coasters on a
// 390px screen, and the whole effect disappeared exactly where scrolling
// happens most.
const BLOBS: Blob[] = [
  {
    depth: -0.07,
    style: {
      left: "16%",
      top: "12%",
      width: "max(38vw, 60vmin)",
      height: "max(38vw, 60vmin)",
      background:
        "radial-gradient(closest-side, rgba(95, 227, 138, 0.16), transparent 70%)",
    },
  },
  {
    depth: -0.14,
    style: {
      right: "4%",
      top: "42%",
      width: "max(44vw, 66vmin)",
      height: "max(44vw, 66vmin)",
      background:
        "radial-gradient(closest-side, rgba(56, 152, 255, 0.14), transparent 72%)",
    },
  },
  {
    depth: -0.22,
    style: {
      left: "30%",
      bottom: "-14%",
      width: "max(48vw, 72vmin)",
      height: "max(48vw, 72vmin)",
      background:
        "radial-gradient(closest-side, rgba(132, 104, 255, 0.13), transparent 70%)",
    },
  },
  {
    depth: -0.1,
    style: {
      left: "-8%",
      bottom: "18%",
      width: "max(34vw, 54vmin)",
      height: "max(34vw, 54vmin)",
      background:
        "radial-gradient(closest-side, rgba(95, 227, 138, 0.11), transparent 70%)",
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
