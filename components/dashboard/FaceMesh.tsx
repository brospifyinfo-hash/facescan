"use client";

import { motion } from "framer-motion";
import type { MeshPaths } from "@/lib/store";
import { alpha, BRAND } from "@/lib/theme";

/**
 * Biometric overlay drawn from the REAL 478 MediaPipe landmarks, in
 * normalized (0..1) image space.
 *
 * The inner box is set to the photo's own aspect ratio and the image uses
 * object-fill, so the SVG (viewBox 0 0 1 1, preserveAspectRatio="none")
 * lands pixel-for-pixel on the face. The outer frame can then be any shape
 * — which is what lets the front and side photos sit side by side at equal
 * height even when their aspect ratios differ.
 */
export function FaceMesh({
  src,
  mesh,
  aspect,
  label,
  scanning = false,
  chrome = true,
  className,
}: {
  src?: string;
  mesh: MeshPaths | null;
  aspect: number;
  label?: string;
  scanning?: boolean;
  /**
   * Draw the viewfinder brackets and the caption. Off when the caller frames
   * the photo itself — the report's scan stage owns its own brackets, and two
   * sets at two insets read as a rendering bug rather than as a frame.
   */
  chrome?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`surface-sunken relative flex items-center justify-center overflow-hidden ${className ?? ""}`}
    >
      <div
        className="relative h-full max-h-full w-full"
        style={{ aspectRatio: aspect || 0.8, maxWidth: "100%" }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: "fill" }}
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--color-surface)]/60" />
        )}

        <div className="absolute inset-0 bg-[var(--color-canvas)]/25" />

        {mesh ? (
          <svg
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <motion.path
              d={mesh.tesselation}
              fill="none"
              stroke={BRAND.accent}
              strokeWidth={0.0007}
              opacity={0.22}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2.4, ease: "easeOut" }}
            />
            <motion.path
              d={mesh.contours}
              fill="none"
              stroke={BRAND.accent}
              strokeWidth={0.0022}
              strokeLinecap="round"
              opacity={0.85}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, delay: 0.2, ease: "easeOut" }}
            />
            <motion.path
              d={mesh.dots}
              fill="none"
              stroke={BRAND.accentBright}
              strokeWidth={0.0035}
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            />
          </svg>
        ) : (
          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage: `linear-gradient(${alpha(BRAND.accent, 0.5)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(BRAND.accent, 0.5)} 1px, transparent 1px)`,
              backgroundSize: "22px 22px",
            }}
          />
        )}

        {scanning ? (
          <motion.div
            className="absolute inset-x-0 h-24"
            style={{
              background: `linear-gradient(to bottom, transparent, ${alpha(BRAND.accent, 0.25)} 55%, ${alpha(BRAND.accent, 0.9)} 98%, transparent)`,
            }}
            animate={{ top: ["-25%", "100%"] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
      </div>

      {/* Viewfinder brackets sit on the outer frame */}
      {chrome
        ? (
            [
              "left-2.5 top-2.5 border-l border-t",
              "right-2.5 top-2.5 border-r border-t",
              "left-2.5 bottom-2.5 border-b border-l",
              "right-2.5 bottom-2.5 border-b border-r",
            ] as const
          ).map((cls) => (
            <span
              key={cls}
              className={`pointer-events-none absolute h-4 w-4 border-accent/60 ${cls}`}
            />
          ))
        : null}

      {chrome && label ? (
        <span className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-canvas)]/60 px-2.5 py-0.5 t-eyebrow text-[var(--color-ink-secondary)] backdrop-blur-sm">
          {label}
        </span>
      ) : null}
    </div>
  );
}
