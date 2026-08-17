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

// Both taken from the exported files. They are here so the width attribute
// reserves the right box before the image loads — a wrong ratio shows up as
// the header shifting sideways on first paint, which is exactly the kind of
// thing nobody traces back to a constant.
const RATIO_LOCKUP = 640 / 153;
const RATIO_MARK = 177 / 256;

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
      width={Math.round(height * (mark ? RATIO_MARK : RATIO_LOCKUP))}
      // Explicit dimensions AND a style height: the attributes reserve the
      // space before the file loads so the header does not jump, the style
      // is what actually sizes it once the CSS lands.
      style={{ height }}
      // object-contain is the guarantee, not the belt-and-braces. The wrapper
      // spans are flex items without shrink-0, so a tight header — a 320px
      // phone, or a longer word than "VERTRAULICH" in another language —
      // squeezes the image and a plain <img> answers by DISTORTING: measured
      // 6% narrower at 320px, which on a wordmark is visible and reads as a
      // cheap build. With object-contain the worst case is empty space beside
      // the mark instead of a stretched one.
      className={`w-auto shrink-0 select-none object-contain object-left ${className}`}
      draggable={false}
    />
  );
}
