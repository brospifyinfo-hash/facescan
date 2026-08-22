"use client";

import { useCallback, useEffect, useRef } from "react";

// The six-digit field.
//
// THE RING IS THE FIELD, NOT AN ORNAMENT. Six arcs, one per digit: dotted
// while empty, solid accent once that digit is typed. So the circle fills
// as the customer types, and the flourish at the end completes something
// they have been watching happen rather than appearing out of nowhere.
// (The first version floated a decorative ring above the boxes with no
// relationship to them, which is exactly why it read as clip-art.)
//
// THE MOTION comes from the reference the owner supplied, whose instruction
// is quoted because it is the whole trick: "never SAMPLE a turn — move the
// origin to the hub and a plain rotate() draws an exact circle, 2
// keyframes". Each slot takes its transform-origin to the hub and rotates
// 450 degrees; the compositor draws the circle, JavaScript touches nothing
// per frame, and a separate opacity curve collapses the digit into the
// point. 450 rather than 360 because a full circle lands a digit back
// exactly where the eye last saw it and reads as a twitch.
//
// Keyboard behaviour is the part people actually notice and is unchanged:
// paste fills every box, digits advance, Backspace on an empty box steps
// back, arrows move without editing, and autoComplete="one-time-code" lets
// a phone offer the code from the notification.

const WIND_UP_BRAKE = "cubic-bezier(0.62, -0.34, 0.2, 1)";
const TURN_MS = 760;
const STAGGER_MS = 38;

/** How long the whole flourish lasts, for the caller advancing the screen. */
export const ORBIT_TOTAL_MS = TURN_MS + STAGGER_MS * 5 + 90;

// Ring geometry. r is in the SVG's own units; the segments are laid out by
// dash arithmetic rather than by six rotated paths, so the gaps stay exact
// at any size.
const R = 38;
const CIRC = 2 * Math.PI * R;
const SLOT_ARC = CIRC / 6;
const GAP = 9;

export function OrbitCode({
  value,
  onChange,
  onComplete,
  disabled,
  verdict,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** "ok" runs the orbit, "bad" shakes the row. Null is the resting state. */
  verdict?: "ok" | "bad" | null;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const hub = useRef<HTMLSpanElement>(null);
  const boxes = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (value.length === 6) onComplete?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (disabled) return;
    const id = window.setTimeout(() => refs.current[0]?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [disabled]);

  const orbit = useCallback(() => {
    const hubEl = hub.current;
    if (!hubEl) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const h = hubEl.getBoundingClientRect();
    const hubX = h.left + h.width / 2;
    const hubY = h.top + h.height / 2;

    refs.current.forEach((slot, i) => {
      if (!slot) return;
      const r = slot.getBoundingClientRect();
      // The hub, in this slot's own coordinate space. With the origin moved
      // there, rotation alone traces the circle — see the header.
      slot.style.transformOrigin = `${hubX - r.left}px ${hubY - r.top}px`;
      slot.animate(
        [{ transform: "rotate(0deg)" }, { transform: "rotate(450deg)" }],
        { duration: TURN_MS, delay: i * STAGGER_MS, easing: WIND_UP_BRAKE, fill: "both" },
      );
      slot.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.62 },
          { opacity: 0, offset: 1 },
        ],
        {
          duration: TURN_MS,
          delay: i * STAGGER_MS,
          easing: "cubic-bezier(0.4,0,0.2,1)",
          fill: "both",
        },
      );
    });
  }, []);

  useEffect(() => {
    if (verdict === "ok") orbit();
  }, [verdict, orbit]);

  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  const handleChange = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;

    if (typed.length > 1) {
      const merged = (value.slice(0, index) + typed).slice(0, 6);
      onChange(merged);
      focus(merged.length);
      return;
    }

    const chars = value.split("");
    chars[index] = typed;
    onChange(chars.slice(0, 6).join("").slice(0, 6));
    focus(index + 1);
  };

  const handleKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        focus(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(index + 1);
    }
  };

  return (
    <div>
      {/* The ring: six arcs, one per digit, and the point they collapse to. */}
      <div className="orbit" aria-hidden>
        <svg className="orbit__ring" viewBox="0 0 92 92">
          <g transform="rotate(-90 46 46)">
            <circle className="orbit__track" cx="46" cy="46" r={R} />
            {boxes.map((d, i) => (
              <circle
                key={i}
                className="orbit__seg"
                cx="46"
                cy="46"
                r={R}
                data-on={verdict === "ok" || d ? "true" : "false"}
                data-verdict={verdict === "bad" ? "bad" : undefined}
                strokeDasharray={`${(SLOT_ARC - GAP).toFixed(2)} ${(CIRC - SLOT_ARC + GAP).toFixed(2)}`}
                strokeDashoffset={(-i * SLOT_ARC).toFixed(2)}
              />
            ))}
          </g>
        </svg>
        <span ref={hub} className="orbit__hub" data-verdict={verdict ?? undefined} />
      </div>

      <div className={`mt-7 flex justify-center gap-1.5 ${verdict === "bad" ? "slots-wrong" : ""}`}>
        {boxes.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={6}
            disabled={disabled}
            value={d}
            data-filled={d ? "true" : "false"}
            data-verdict={verdict === "bad" ? "bad" : undefined}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Ziffer ${i + 1}`}
            className="slot"
          />
        ))}
      </div>
    </div>
  );
}
