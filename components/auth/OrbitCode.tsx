"use client";

import { useEffect, useRef } from "react";

// The six-digit field, and the beam that runs along the active box.
//
// THE LIGHT RIDES THE BORDER ITSELF. Not a ring around the slot — a beam
// travelling ON the slot's own outline, in the slot's own shape, which is
// what makes it read as part of the field rather than as an ornament
// parked near it. It is an SVG rounded rect matching the slot exactly,
// carrying two strokes: a short bright head and a longer faint tail on the
// loop behind it. Only stroke-dashoffset animates, so the compositor draws
// every frame and JavaScript touches none of them.
//
// pathLength="100" is the trick worth keeping: it normalises the outline to
// a hundred units, so the dash lengths are percentages and stay right
// whatever the slot measures at any breakpoint. Without it every change to
// the slot size would silently change the beam's length and speed.
//
// CONFIRMATION is three beats, timed in CSS: the beam takes one fast last
// lap and goes out, the digits lift in a left-to-right wave, and a check
// draws itself where they were. The caller advances the screen once the
// last beat has been read — hence the exported total.

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
  const boxes = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  // The slot the light belongs to: the first empty one, or the last once
  // the code is complete.
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
    <div className="code-row" data-verdict={verdict ?? undefined}>
      {boxes.map((d, i) => (
        <span key={i} className="slot-wrap" data-active={i === active ? "true" : "false"}>
          <input
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
          {/* The outline the light runs on. Inset by half the stroke so the
              beam sits ON the border rather than straddling its outside. */}
          <svg className="slot-beam" viewBox="0 0 42 54" aria-hidden>
            <rect
              className="slot-beam__path slot-beam__tail"
              x="1.3"
              y="1.3"
              width="39.4"
              height="51.4"
              rx="13.7"
              pathLength="100"
            />
            <rect
              className="slot-beam__path slot-beam__head"
              x="1.3"
              y="1.3"
              width="39.4"
              height="51.4"
              rx="13.7"
              pathLength="100"
            />
          </svg>
        </span>
      ))}

      {/* Drawn where the digits were, once they have taken their bow. */}
      <svg className="code-check" viewBox="0 0 62 62" aria-hidden>
        <circle className="code-check__ring" cx="31" cy="31" r="27" />
        <path className="code-check__path" d="M20 32.5 L27.5 40 L43 23" />
      </svg>
    </div>
  );
}
