"use client";

import { useCallback, useEffect, useRef } from "react";

// The six-digit field, built on the reference the owner supplied.
//
// THE MOTION, AND WHY IT IS BUILT THIS WAY
// ----------------------------------------
// On a correct code the digits ORBIT the hub once and collapse into it.
// The reference states the mechanism and the reason in one line — "never
// SAMPLE a turn: move the origin to the hub and a plain rotate() draws an
// exact circle, 2 keyframes" — so that is exactly what happens here: each
// slot gets a transform-origin at the hub expressed in its own coordinates,
// then two keyframes take it from 0deg to 450deg. No path sampling, no
// per-frame JavaScript, and the compositor owns the whole thing.
//
// 450 rather than 360 so the turn ends a quarter past where it started: a
// full circle lands the digit back where the eye last saw it and reads as a
// twitch, while the extra quarter reads as travel that arrived somewhere.
//
// WIND_UP_BRAKE is the reference easing: a touch of counter-motion before
// the turn (the wind-up), then a long settle (the brake).
//
// The keyboard behaviour is the part people actually notice and is kept
// from the field this replaces: paste fills every box, digits advance,
// Backspace on an empty box steps back, arrows move without editing, and
// autoComplete="one-time-code" lets a phone offer the code from the
// notification.

const WIND_UP_BRAKE = "cubic-bezier(0.62, -0.34, 0.2, 1)";
const TURN_MS = 800;
const STAGGER_MS = 42;

/** How long the whole flourish lasts, for the caller advancing the screen. */
export const ORBIT_TOTAL_MS = TURN_MS + STAGGER_MS * 5 + 120;

export function OrbitCode({
  value,
  onChange,
  onComplete,
  disabled,
  verdict,
  busy,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** "ok" runs the orbit, "bad" shakes the row. Null is the resting state. */
  verdict?: "ok" | "bad" | null;
  busy?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const hub = useRef<HTMLSpanElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const boxes = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (value.length === 6) onComplete?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Focus the first empty box when the field appears — one less tap.
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
      // The collapse rides alongside the turn rather than inside it: the
      // rotation must stay at two keyframes, and opacity is a different
      // property with a different curve anyway.
      slot.animate(
        [
          { opacity: 1, filter: "brightness(1)", offset: 0 },
          { opacity: 1, filter: "brightness(1.9)", offset: 0.55 },
          { opacity: 0, filter: "brightness(1)", offset: 1 },
        ],
        { duration: TURN_MS, delay: i * STAGGER_MS, easing: "cubic-bezier(0.4,0,0.2,1)", fill: "both" },
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
    const next = chars.slice(0, 6).join("").slice(0, 6);
    onChange(next);
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
      {/* The track, and the point the digits collapse onto. */}
      <div className="orbit" aria-hidden>
        <svg className="orbit__ring" viewBox="0 0 116 116">
          <circle
            className="orbit__path"
            cx="58"
            cy="58"
            r="50"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          ref={hub}
          className="orbit__hub"
          data-verdict={verdict ?? undefined}
          style={busy ? { transform: "scale(1.6)" } : undefined}
        />
      </div>

      <div
        ref={row}
        className={`mt-7 flex justify-center gap-2 ${verdict === "bad" ? "slots-wrong" : ""}`}
      >
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
