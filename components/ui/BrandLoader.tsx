"use client";

import { Logo } from "./Logo";

// Waiting, with the brand on it.
//
// TWO SIZES OF THE SAME IDEA. BrandSpinner replaces a bare lucide spinner
// inside a card; BrandLoadingScreen covers the viewport while something big
// is happening. Both are the mark inside a ring that is drawing itself, so a
// wait looks like part of the product rather than like a stalled page.
//
// THE RING IS A DASH OFFSET, NOT A ROTATING BORDER. A rotating ring reads as
// "working"; an arc that travels reads as "progressing", and at a wait of
// several seconds the difference is whether it feels stuck. Neither claims a
// percentage, because neither knows one.
//
// prefers-reduced-motion stops the travel and leaves a static ring plus the
// label. The label is what actually carries the information, which is why it
// is never the thing that gets dropped.

export function BrandSpinner({
  label,
  size = 64,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth="4"
          />
          <circle
            className="brand-arc"
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <Logo mark height={Math.round(size * 0.42)} />
        </span>
      </div>
      {label ? (
        <p className="text-[12.5px] text-[var(--color-ink-secondary)]" role="status">
          {label}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Full-viewport wait.
 *
 * `fixed` and above everything, with the canvas colour behind it, so whatever
 * is underneath cannot show through half-rendered — which is the thing a
 * loading screen exists to prevent.
 */
export function BrandLoadingScreen({
  label,
  hint,
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[var(--color-canvas)] px-8"
      role="status"
      aria-live="polite"
    >
      <Logo height={40} className="opacity-95" />
      <BrandSpinner size={78} />
      {label ? (
        <p className="max-w-[30ch] text-center text-[14px] font-medium text-[var(--color-ink)]">
          {label}
        </p>
      ) : null}
      {hint ? (
        <p className="max-w-[36ch] text-center text-[12px] leading-relaxed text-[var(--color-ink-tertiary)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
