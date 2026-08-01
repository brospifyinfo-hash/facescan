"use client";

import { motion } from "framer-motion";
import type { MeshPaths } from "@/lib/store";

/**
 * Biometric overlay drawn from the REAL 478 MediaPipe landmarks, in
 * normalized (0..1) image space. The container is set to the photo's own
 * aspect ratio and the image uses object-fill, so the SVG (viewBox 0 0 1 1,
 * preserveAspectRatio="none") lands pixel-for-pixel on the face.
 */
export function FaceMesh({
  src,
  mesh,
  aspect,
  scanning = false,
  className,
}: {
  src?: string;
  mesh: MeshPaths | null;
  aspect: number;
  scanning?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 ${className ?? ""}`}
      style={{ aspectRatio: aspect || 0.8 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Analyzed portrait"
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: "fill" }}
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}

      {/* Darkening pass so the mesh reads clearly over any skin tone */}
      <div className="absolute inset-0 bg-zinc-950/25" />

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
            stroke="#95BF47"
            strokeWidth={0.0007}
            opacity={0.22}
            initial={{ pathLength: scanning ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
          />
          <path
            d={mesh.contours}
            fill="none"
            stroke="#95BF47"
            strokeWidth={0.0022}
            strokeLinecap="round"
            opacity={0.85}
          />
          <path
            d={mesh.dots}
            fill="none"
            stroke="#CFF08A"
            strokeWidth={0.0035}
            strokeLinecap="round"
            opacity={0.55}
          />
        </svg>
      ) : (
        // No landmark data (demo mode) — technical grid stand-in.
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(149,191,71,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(149,191,71,0.4) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
      )}

      {scanning ? (
        <motion.div
          className="absolute inset-x-0 h-28"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(149,191,71,0.25) 55%, rgba(149,191,71,0.9) 98%, transparent)",
          }}
          animate={{ top: ["-25%", "100%"] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        />
      ) : null}

      {/* Corner brackets — viewfinder framing */}
      {(
        [
          "left-3 top-3 border-l-2 border-t-2",
          "right-3 top-3 border-r-2 border-t-2",
          "left-3 bottom-3 border-b-2 border-l-2",
          "right-3 bottom-3 border-b-2 border-r-2",
        ] as const
      ).map((cls) => (
        <span
          key={cls}
          className={`pointer-events-none absolute h-5 w-5 border-accent/70 ${cls}`}
        />
      ))}
    </div>
  );
}
