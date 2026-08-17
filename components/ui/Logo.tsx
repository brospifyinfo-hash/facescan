// The brand mark.
//
// ONE COMPONENT BECAUSE IT APPEARS IN THREE PLACES — the app header, the
// report header and the footer — and a wordmark that is pasted per location
// is a wordmark that ends up at three different sizes with three different
// spellings the next time it changes. It changed once already.
//
// AN IMAGE, NOT DRAWN TYPE. The M carries two face profiles cut out of the
// counters; that is the whole idea of the mark and it is not something a
// font plus an icon reproduces. The file is cropped to its visible pixels —
// the supplied export had transparent margins that would otherwise push the
// lockup off-centre against everything beside it.
//
// The wordmark is white and the accent is the green, so it only works on a
// dark ground. That is the only ground this app has.

const RATIO = 640 / 157;

export function Logo({
  /** Rendered height in px. Width follows the artwork. */
  height = 34,
  /** Just the M, for places too narrow for the wordmark. */
  mark = false,
  className = "",
}: {
  height?: number;
  mark?: boolean;
  className?: string;
}) {
  const src = mark ? "/logo-malook-mark.webp" : "/logo-malook.webp";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="malook"
      height={height}
      width={mark ? Math.round(height * (256 / 234)) : Math.round(height * RATIO)}
      // Explicit dimensions AND a style height: the attributes reserve the
      // space before the file loads so the header does not jump, the style
      // is what actually sizes it once the CSS lands.
      style={{ height }}
      className={`w-auto shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}
