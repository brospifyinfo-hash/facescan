"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FaceMesh } from "@/components/dashboard/FaceMesh";
import { useT } from "@/lib/i18n";
import type { MeshPaths } from "@/lib/store";

// The reveal that plays once, right after a purchase lands.
//
// WHAT IT SAYS AND WHAT IT DOES NOT
// ---------------------------------
// It replays the scan visualisation over the customer's own photograph while
// the paid sections mount behind it. That is theatre, and theatre is fine —
// a report that simply appears feels like a page load, and the work that was
// paid for deserves a moment.
//
// What it must not do is claim a SECOND MEASUREMENT happened. Nothing is
// re-measured here: the numbers were computed on the device before payment
// and are identical afterwards. So the lines describe what is genuinely
// going on — the full evaluation being assembled and unlocked — rather than
// "scanning your face again", which would be a lie told with a progress bar.
// If the figures were ever to change after payment, that would be the real
// problem and no wording could cover it.
//
// It runs ONCE per session. A customer who scrolls back up should not be made
// to sit through it again, and sessionStorage is the right scope: a new tab
// is a new purchase moment, a re-render is not.

const SEEN_KEY = "facescan.simulation";
/** Four steps at 1.1s, plus a beat to read the last one. */
const STEP_MS = 1100;

export function UnlockSimulation({
  src,
  mesh,
  aspect,
  onDone,
}: {
  src?: string;
  mesh: MeshPaths | null;
  aspect: number;
  onDone?: () => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const steps = t.results.simulationSteps;

  // Reduced motion means "do not animate", not "show a shorter animation" —
  // the whole overlay is skipped and the report is simply there.
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    if (reduce) return false;
    return sessionStorage.getItem(SEEN_KEY) !== "1";
  });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    sessionStorage.setItem(SEEN_KEY, "1");

    const timers = steps.map((_, i) =>
      window.setTimeout(() => setStep(i), i * STEP_MS),
    );
    const end = window.setTimeout(() => {
      setOpen(false);
      onDone?.();
    }, steps.length * STEP_MS + 600);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(end);
    };
  }, [open, steps, onDone]);

  const pct = Math.round(((step + 1) / steps.length) * 100);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="sim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-canvas)]/95 px-6 backdrop-blur-md"
          // Announced, but not focus-trapping: it dismisses itself and there
          // is nothing here to interact with.
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-[240px] overflow-hidden rounded-[var(--r-panel)]">
            <div className="relative aspect-[4/5] w-full">
              <FaceMesh
                src={src}
                mesh={mesh}
                aspect={aspect}
                scanning
                chrome={false}
                className="absolute inset-0 h-full w-full !rounded-none !border-0 !bg-transparent"
              />
              {(
                [
                  "left-3 top-3 border-l-2 border-t-2 rounded-tl-md",
                  "right-3 top-3 border-r-2 border-t-2 rounded-tr-md",
                  "left-3 bottom-3 border-b-2 border-l-2 rounded-bl-md",
                  "right-3 bottom-3 border-b-2 border-r-2 rounded-br-md",
                ] as const
              ).map((cls) => (
                <span key={cls} aria-hidden className={`scan-corner ${cls}`} />
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-[13px] font-medium text-[var(--color-ink)]">
            {steps[step]}
          </p>

          <div className="mt-4 w-full max-w-[240px]">
            <span className="bar-track block">
              <motion.span
                className="bar-fill"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              />
            </span>
          </div>

          <p className="mt-3 text-center text-[10.5px] text-[var(--color-ink-quaternary)]">
            {t.results.simulationNote}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
