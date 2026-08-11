"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FaceMesh } from "@/components/dashboard/FaceMesh";
import { useT } from "@/lib/i18n";
import type { MeshPaths } from "@/lib/store";

/**
 * The face, and the furniture that makes it read as a scan rather than as a
 * profile picture.
 *
 * WHERE THE METADATA GOES, AND WHY IT MOVED
 * -----------------------------------------
 * The reference stacks the scan id and the date over the photo on the left.
 * That works in a mock, where the face is a stock portrait framed with room
 * to spare. Here the photo is whatever the user took — usually a head filling
 * the frame — so a 110px column of cards lands on their cheek at 390px wide
 * and on their eye at 320px. The brief's own rule for this block is that the
 * metadata must never compete with the face.
 *
 * So: the status pill stays on the photo, because "face detected" is about
 * the photo and belongs on it. The id and the date drop to a strip inside the
 * same panel, below the image. Same panel, same reading order, nothing on the
 * face.
 */
export function ScanStage({
  src,
  mesh,
  aspect,
  reference,
  date,
}: {
  src?: string;
  mesh: MeshPaths | null;
  aspect: number;
  reference: string;
  date: string;
}) {
  const t = useT();
  const reduce = useReducedMotion();

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className="panel overflow-hidden"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <FaceMesh
          src={src}
          mesh={mesh}
          aspect={aspect}
          chrome={false}
          className="absolute inset-0 h-full w-full !rounded-none !border-0 !bg-transparent"
        />

        {/* Vignette. Without it the pill and the brackets sit on whatever
            happened to be behind them, and a bright window in the background
            takes the status text with it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(115% 85% at 50% 42%, transparent 38%, rgba(5,8,13,0.62) 100%)",
          }}
        />

        {/* Four corners, not a frame. */}
        {(
          [
            "left-4 top-4 border-l-2 border-t-2 rounded-tl-md",
            "right-4 top-4 border-r-2 border-t-2 rounded-tr-md",
            "left-4 bottom-4 border-b-2 border-l-2 rounded-bl-md",
            "right-4 bottom-4 border-b-2 border-r-2 rounded-br-md",
          ] as const
        ).map((cls, i) => (
          <motion.span
            key={cls}
            aria-hidden
            className={`scan-corner ${cls}`}
            initial={reduce ? false : { opacity: 0, scale: 0.86 }}
            animate={{ opacity: 0.75, scale: 1 }}
            transition={{ duration: 0.45, delay: reduce ? 0 : 0.25 + i * 0.07 }}
          />
        ))}

        <motion.div
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: reduce ? 0 : 0.5 }}
          // top-14, not top-4: at top-4 it sat exactly on the top-left
          // bracket and swallowed it, so the viewfinder read as three
          // corners. Below the bracket it also matches the reference, where
          // the status sits down the left edge rather than in the corner.
          className="absolute left-4 top-14 flex items-center gap-2 rounded-full border border-white/10 bg-[var(--color-canvas)]/70 px-2.5 py-1.5 backdrop-blur-md"
        >
          <span className="status-dot" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
            {t.results.faceDetected}
          </span>
        </motion.div>
      </div>

      {/* Secondary by construction: 10px labels, a hairline between, and a
          fill rather than a surface so it reads as part of the panel. */}
      <div className="grid grid-cols-2 divide-x divide-[var(--color-hairline)] border-t border-[var(--color-hairline)]">
        {[
          [t.results.scanId, reference],
          [t.results.scanDate, date],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-tertiary)]">
              {label}
            </p>
            <p className="tnum mt-1 text-[13px] font-medium text-[var(--color-ink)]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
