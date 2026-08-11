"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FaceMesh } from "@/components/dashboard/FaceMesh";
import { IconCalendar, IconScanId } from "./icons";
import { useT } from "@/lib/i18n";
import type { MeshPaths } from "@/lib/store";

/**
 * The face, and the furniture that makes it read as a scan rather than as a
 * profile picture.
 *
 * FULL BLEED. The reference runs the photograph edge to edge under a padded
 * header, and everything below it sits in inset cards. That contrast is what
 * makes the scan read as the subject and the rest as the report about it —
 * a photograph in a card is a thumbnail. The section is pulled out of the
 * page gutter with a negative margin rather than the page being unpadded,
 * so nothing else has to know.
 *
 * THE METADATA SITS ON THE PHOTOGRAPH, at the left, as three stacked cards.
 * An earlier pass moved it to a strip below the image to keep it off the
 * face; the brief asked for the reference, so it is back on the left. The
 * vignette underneath is what makes that legible over an arbitrary
 * photograph, and the column is 104px so it stays in the dead space beside
 * a centred head.
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
      className="relative -mx-4 overflow-hidden"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <FaceMesh
          src={src}
          mesh={mesh}
          aspect={aspect}
          chrome={false}
          className="absolute inset-0 h-full w-full !rounded-none !border-0 !bg-transparent"
        />

        {/* Without this the cards sit on whatever happened to be behind them,
            and a bright window in the background takes the labels with it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(112% 82% at 56% 42%, transparent 34%, rgba(5,8,13,0.72) 100%)",
          }}
        />

        {/* Four corners framing the FACE, not the panel — a box at just over
            half the width, centred, the way the reference sets them. A frame
            on the panel edge would be a border; four corners inside it are a
            viewfinder, and the eye closes the rectangle itself. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-[8%] left-1/2 w-[54%] -translate-x-1/2"
        >
          {(
            [
              "left-0 top-0 border-l-2 border-t-2 rounded-tl-lg",
              "right-0 top-0 border-r-2 border-t-2 rounded-tr-lg",
              "left-0 bottom-0 border-b-2 border-l-2 rounded-bl-lg",
              "right-0 bottom-0 border-b-2 border-r-2 rounded-br-lg",
            ] as const
          ).map((cls, i) => (
            <motion.span
              key={cls}
              className={`scan-corner ${cls}`}
              initial={reduce ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 0.8, scale: 1 }}
              transition={{ duration: 0.45, delay: reduce ? 0 : 0.3 + i * 0.07 }}
            />
          ))}
        </div>

        <div className="absolute left-4 top-[13%] flex w-[104px] flex-col gap-2.5">
          <InfoCard label={t.results.status} delay={0.45}>
            <span className="flex items-start gap-1.5">
              <span className="status-dot mt-1 shrink-0" aria-hidden />
              <span className="text-[11px] font-semibold uppercase leading-[1.25] tracking-[0.06em] text-[var(--color-accent)]">
                {t.results.faceDetected}
              </span>
            </span>
          </InfoCard>

          <InfoCard
            label={t.results.scanId}
            icon={<IconScanId className="h-3.5 w-3.5" />}
            delay={0.52}
          >
            <span className="tnum text-[12px] font-medium text-[var(--color-ink)]">
              {reference}
            </span>
          </InfoCard>

          <InfoCard
            label={t.results.scanDate}
            icon={<IconCalendar className="h-3.5 w-3.5" />}
            delay={0.59}
          >
            <span className="tnum text-[12px] font-medium text-[var(--color-ink)]">
              {date}
            </span>
          </InfoCard>
        </div>
      </div>
    </motion.section>
  );
}

/**
 * One metadata card. Deliberately quiet: a 9px label over a 12px value, on a
 * blurred plate rather than a surface, because these must never compete with
 * the face they are sitting on.
 */
function InfoCard({
  label,
  icon,
  children,
  delay,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  delay: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : delay }}
      className="rounded-[14px] border border-white/10 bg-[var(--color-canvas)]/72 px-2.5 py-2 backdrop-blur-md"
    >
      <span className="flex items-center gap-1 text-[var(--color-ink-tertiary)]">
        {icon}
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.1em]">
          {label}
        </span>
      </span>
      <span className="mt-1 block">{children}</span>
    </motion.div>
  );
}
