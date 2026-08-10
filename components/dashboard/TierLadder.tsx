"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TIER_ORDER, type BandId } from "@/lib/metrics";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/theme";

/**
 * Neutral parametric face.
 *
 * `t` runs 0 (furthest from the reference proportions) to 1 (matching them).
 * What varies is jaw taper, chin length and midface height — the dimensions
 * the scan actually measures. Nothing is caricatured: every tier is the same
 * clean line drawing, differing only in proportion, because the score is a
 * statement about proportions and not about anyone's worth.
 */
function FaceGlyph({ t, active }: { t: number; active: boolean }) {
  const cx = 30;

  // Each parameter is one of the things the scan actually measures, driven
  // hard enough to be legible at ~42px. Subtle was useless: seven glyphs
  // that look the same communicate nothing.
  const cheekW = 24 - 5.0 * t;              // bizygomatic width
  const jawRatio = 1.08 - 0.44 * t;         // bigonial / bizygomatic taper
  const jawW = cheekW * jawRatio;
  const chinY = 49 + 15 * t;                // lower-third length
  const gonialY = 36 + 6 * t;               // where the jaw turns
  const eyeY = 34 - 3.5 * t;
  const eyeGap = 5.0 + 1.2 * t;
  const eyeW = 4.4 + 1.6 * t;
  const tiltDeg = -2 + 11 * t;              // canthal tilt, −2° → +9°
  const rise = Math.tan((tiltDeg * Math.PI) / 180) * eyeW;
  const browLift = 3.6 + 2.4 * t;
  const cheekbone = Math.max(0, t * 1.4 - 0.35); // only emerges high up

  const stroke = active ? BRAND.accent : "rgba(255,255,255,0.38)";

  const head = [
    `M${cx - cheekW} ${gonialY - 8}`,
    `C${cx - cheekW} 14, ${cx - cheekW * 0.66} 7, ${cx} 7`,
    `C${cx + cheekW * 0.66} 7, ${cx + cheekW} 14, ${cx + cheekW} ${gonialY - 8}`,
    // cheek down to the gonion, then the jawline in to the chin
    `L${cx + jawW} ${gonialY + 6}`,
    `C${cx + jawW * 0.92} ${chinY - 9}, ${cx + jawW * 0.46} ${chinY - 2}, ${cx} ${chinY}`,
    `C${cx - jawW * 0.46} ${chinY - 2}, ${cx - jawW * 0.92} ${chinY - 9}, ${cx - jawW} ${gonialY + 6}`,
    "Z",
  ].join(" ");

  const eye = (dir: 1 | -1) => {
    const x0 = cx + dir * eyeGap;
    const x1 = cx + dir * (eyeGap + eyeW);
    return `M${x0} ${eyeY} Q${(x0 + x1) / 2} ${eyeY - 2.2 - t} ${x1} ${eyeY - rise}`;
  };
  const brow = (dir: 1 | -1) => {
    const x0 = cx + dir * (eyeGap - 0.6);
    const x1 = cx + dir * (eyeGap + eyeW + 1.2);
    const y = eyeY - browLift;
    return `M${x0} ${y + 1.0} Q${(x0 + x1) / 2} ${y - 1.6 - t} ${x1} ${y - rise}`;
  };

  // Hair fills out up the ladder: thinning fringe at the bottom, a styled
  // sweep in the middle, and the long curtain the top tier is known for.
  const hair =
    t < 0.3
      ? // sparse fringe
        `M${cx - cheekW * 0.72} 15 Q${cx} 4 ${cx + cheekW * 0.72} 15 Q${cx + cheekW * 0.3} 11 ${cx} 12 Q${cx - cheekW * 0.3} 11 ${cx - cheekW * 0.72} 15 Z`
      : t < 0.62
        ? // fuller cap
          `M${cx - cheekW * 0.95} 20 Q${cx - cheekW * 0.8} 4 ${cx} 3.5 Q${cx + cheekW * 0.8} 4 ${cx + cheekW * 0.95} 20 Q${cx + cheekW * 0.55} 12 ${cx} 12.5 Q${cx - cheekW * 0.55} 12 ${cx - cheekW * 0.95} 20 Z`
        : t < 0.92
          ? // styled sweep with volume
            `M${cx - cheekW * 1.02} 24 Q${cx - cheekW * 0.95} 2 ${cx} 2 Q${cx + cheekW * 0.95} 2 ${cx + cheekW * 1.02} 24 Q${cx + cheekW * 0.6} 11 ${cx - cheekW * 0.12} 13 Q${cx - cheekW * 0.7} 13 ${cx - cheekW * 1.02} 24 Z`
          : // long curtain framing the face, centre-parted
            `M${cx - cheekW * 1.14} ${chinY - 4} Q${cx - cheekW * 1.3} 22 ${cx - cheekW * 0.8} 6 Q${cx} -2 ${cx + cheekW * 0.8} 6 Q${cx + cheekW * 1.3} 22 ${cx + cheekW * 1.14} ${chinY - 4} Q${cx + cheekW * 0.92} ${chinY - 22} ${cx + cheekW * 0.62} 14 Q${cx + cheekW * 0.2} 9 ${cx} 15 Q${cx - cheekW * 0.2} 9 ${cx - cheekW * 0.62} 14 Q${cx - cheekW * 0.92} ${chinY - 22} ${cx - cheekW * 1.14} ${chinY - 4} Z`;

  const hairFill = active ? "rgba(149,191,71,0.30)" : "rgba(255,255,255,0.15)";

  return (
    <svg viewBox="0 0 60 76" className="h-full w-full" aria-hidden>
      <path
        d={head}
        fill={active ? "rgba(149,191,71,0.10)" : "rgba(255,255,255,0.03)"}
        stroke={stroke}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path d={hair} fill={hairFill} stroke={stroke} strokeWidth={1.3} strokeLinejoin="round" />

      {/* Cheekbone contour — only appears once the taper is pronounced */}
      {cheekbone > 0.02 ? (
        <>
          <path
            d={`M${cx - cheekW + 2.5} ${gonialY - 3} Q${cx - cheekW * 0.5} ${gonialY + 3} ${cx - cheekW * 0.34} ${gonialY + 7}`}
            fill="none"
            stroke={stroke}
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={cheekbone}
          />
          <path
            d={`M${cx + cheekW - 2.5} ${gonialY - 3} Q${cx + cheekW * 0.5} ${gonialY + 3} ${cx + cheekW * 0.34} ${gonialY + 7}`}
            fill="none"
            stroke={stroke}
            strokeWidth={1.1}
            strokeLinecap="round"
            opacity={cheekbone}
          />
        </>
      ) : null}

      {[1, -1].map((d) => (
        <path key={`e${d}`} d={eye(d as 1 | -1)} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
      ))}
      {[1, -1].map((d) => (
        <path
          key={`b${d}`}
          d={brow(d as 1 | -1)}
          fill="none"
          stroke={stroke}
          strokeWidth={1.1 + 0.9 * t}
          strokeLinecap="round"
        />
      ))}

      <path
        d={`M${cx - 1.5} ${eyeY + 9 + 2 * t} Q${cx} ${eyeY + 11.6 + 2 * t} ${cx + 1.5} ${eyeY + 9 + 2 * t}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <path
        d={`M${cx - 5} ${eyeY + 16 + 3.5 * t} Q${cx} ${eyeY + 17.6 + 3.5 * t} ${cx + 5} ${eyeY + 16 + 3.5 * t}`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Horizontal ladder of the seven tiers with the user's position marked. */
export function TierLadder({ current }: { current: BandId }) {
  const t = useT();
  const reduce = useReducedMotion();
  const currentIndex = TIER_ORDER.indexOf(current);

  return (
    <section className="surface p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
          <span aria-hidden>🪜</span> {t.results.tierTitle}
        </h2>
        <span className="text-[11px] text-[var(--color-ink-tertiary)]">{t.results.tierSub}</span>
      </div>

      <ol className="mt-5 grid grid-cols-7 gap-1">
        {TIER_ORDER.map((id, i) => {
          const active = i === currentIndex;
          return (
            <motion.li
              key={id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.06 }}
              className={cn(
                "relative flex flex-col items-center rounded-2xl px-0.5 py-2 transition-colors",
                active
                  ? "scale-[1.08] bg-accent/[0.12] ring-1 ring-accent/50"
                  : "opacity-45",
              )}
              aria-current={active ? "step" : undefined}
            >
              <div className="h-12 w-full sm:h-16">
                <FaceGlyph t={i / (TIER_ORDER.length - 1)} active={active} />
              </div>
              <span
                className={cn(
                  "mt-1 line-clamp-2 text-center t-caption font-medium leading-tight sm:t-caption",
                  active ? "text-accent" : "text-[var(--color-ink-tertiary)]",
                )}
              >
                {t.bands[id].label}
              </span>
              {active ? (
                <motion.span
                  layoutId="tier-marker"
                  className="mt-1 h-1 w-1.5 rounded-full bg-accent"
                />
              ) : null}
            </motion.li>
          );
        })}
      </ol>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
        {t.bands[current].blurb}
      </p>
      <p className="mt-2 t-caption leading-relaxed text-[var(--color-ink-tertiary)]">
        {t.results.tierNote}
      </p>
    </section>
  );
}
