"use client";

// The small drawn pieces of the home screen: the crop brackets around the
// hero figure, the ring around the last-scan photo, and the potential gauge.
//
// SVG rather than CSS because all three are arcs with a value in them. A ring
// that shows 64 % is a stroke-dasharray, and faking it with borders and
// transforms is more code that does not survive a size change.

export function CornerBrackets({ className = "" }: { className?: string }) {
  // Four L-shapes, one per corner, as in the reference. aria-hidden: this is
  // framing, and a screen reader announcing "image" four times is noise.
  const arm = "absolute h-5 w-5 border-[var(--color-accent)]";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className={`${arm} left-0 top-0 border-l-2 border-t-2`} />
      <span className={`${arm} right-0 top-0 border-r-2 border-t-2`} />
      <span className={`${arm} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${arm} bottom-0 right-0 border-b-2 border-r-2`} />
    </div>
  );
}

/**
 * A photo inside a progress ring.
 *
 * `value` is 0–10 and drives how far the arc travels, so the ring is a
 * reading of the score rather than decoration. No photo yet is a normal
 * state, not an error — the ring still draws and the middle shows the mesh
 * mark instead.
 */
export function ScoreAvatar({
  src,
  value,
  size = 86,
}: {
  src: string | null;
  value: number | null;
  size?: number;
}) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / 10));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-hairline)" strokeWidth="4" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * pct).toFixed(2)} ${circumference.toFixed(2)}`}
        />
      </svg>
      <div className="absolute inset-[9px] overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/hero-mesh.svg" alt="" className="h-full w-full scale-[1.35] object-contain opacity-70" />
        )}
      </div>
    </div>
  );
}

/** The potential figure as a donut, value in the middle. */
export function PotentialGauge({
  value,
  outOf,
  size = 88,
}: {
  value: number | null;
  outOf: string;
  size?: number;
}) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / 10));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-hairline)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * pct).toFixed(2)} ${circumference.toFixed(2)}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold leading-none tracking-tight text-[var(--color-ink)]">
          {value === null ? "—" : value.toFixed(1)}
        </span>
        <span className="mt-0.5 text-[10px] text-[var(--color-ink-tertiary)]">{outOf}</span>
      </div>
    </div>
  );
}

/** The circular star badge on the tip card, with its partial ring. */
export function TipBadge() {
  return (
    <div aria-hidden className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-hairline)" strokeWidth="3" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="212 283"
          opacity="0.85"
        />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute inset-0 m-auto h-7 w-7"
      >
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
    </div>
  );
}
