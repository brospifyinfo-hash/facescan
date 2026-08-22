"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The six-digit field, and the ring that circles the digit being typed.
//
// THE MOVING PART IS ATTACHED TO WHAT THE CUSTOMER IS DOING. Earlier
// versions parked a decorative ring above the boxes, which is why it read
// as clip-art: nothing it did was about them. Here a dotted orbit with a
// satellite riding it sits AROUND the active slot and travels to the next
// one as the code fills. Only a transform changes, so the compositor owns
// the move and the rotation both — the reference's "never SAMPLE a turn"
// applies to travel as much as to spin.
//
// THE POSITION IS MEASURED, NOT CALCULATED. Slot width plus gap would work
// until the day someone changes either in the stylesheet, and then the ring
// would sit a few pixels off with nothing to explain why. getBoundingClientRect
// on the live elements is correct by construction, and it is recomputed on
// resize because the row is centred.
//
// CONFIRMATION is three beats, timed in CSS: the ring bursts outward, the
// digits lift in a wave, and a check draws itself where they were. The
// caller advances the screen when the last one has been read — hence the
// exported total.

/** The whole confirmation, for the caller advancing the screen. */
export const ORBIT_TOTAL_MS = 1180;

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
  /** "ok" runs the confirmation, "bad" shakes the row. Null is resting. */
  verdict?: "ok" | "bad" | null;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const row = useRef<HTMLDivElement>(null);
  const [ringX, setRingX] = useState(0);
  const boxes = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  // The slot the ring belongs to: the first empty one, or the last while the
  // code is complete.
  const active = Math.min(5, value.length);

  useEffect(() => {
    if (value.length === 6) onComplete?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (disabled) return;
    const id = window.setTimeout(() => refs.current[0]?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [disabled]);

  const place = useCallback(() => {
    const rowEl = row.current;
    const slot = refs.current[active];
    if (!rowEl || !slot) return;
    const r = rowEl.getBoundingClientRect();
    const s = slot.getBoundingClientRect();
    setRingX(s.left - r.left + s.width / 2);
  }, [active]);

  useEffect(() => {
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

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
    <div ref={row} className="code-row" data-verdict={verdict ?? undefined}>
      {/* The orbit around the active digit. */}
      <div
        className="orbit-cursor"
        aria-hidden
        style={{ transform: `translateX(${ringX}px)` }}
      >
        <svg className="orbit-cursor__spin" viewBox="0 0 76 76">
          <circle className="orbit-cursor__track" cx="38" cy="38" r="33" />
          {/* The satellite sits ON the track, so the ring reads as an orbit
              rather than as a border. */}
          <circle className="orbit-cursor__sat" cx="38" cy="5" r="3.2" />
        </svg>
      </div>

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
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`Ziffer ${i + 1}`}
          className={`slot ${verdict === "ok" ? "slots-fade" : ""}`}
          style={{ "--i": i } as React.CSSProperties}
        />
      ))}

      {/* Drawn where the digits were, once they have taken their bow. */}
      <svg className="code-check" viewBox="0 0 62 62" aria-hidden>
        <circle className="code-check__ring" cx="31" cy="31" r="27" />
        <path className="code-check__path" d="M20 32.5 L27.5 40 L43 23" />
      </svg>
    </div>
  );
}
