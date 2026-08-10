"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Six single-character boxes behaving as one field.
 *
 * `value` is simply the digits entered so far (0–6 characters) — no padding,
 * no placeholder sentinels. The fiddly parts are the ones people notice:
 * paste fills every box, digits advance, Backspace on an empty box steps back
 * and clears the previous one, arrows move without editing. `inputMode` plus
 * `autoComplete="one-time-code"` lets mobile offer the code from the
 * notification.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const boxes = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (value.length === 6) onComplete?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus();

  const handleChange = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;

    if (typed.length > 1) {
      // Paste — fill from this box onward.
      const merged = (value.slice(0, index) + typed).slice(0, 6);
      onChange(merged);
      focus(merged.length);
      return;
    }

    const chars = value.split("");
    chars[index] = typed;
    // Keep it contiguous: never leave a hole behind the caret.
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
    <div className="flex justify-center gap-2">
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
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "w-11 rounded-xl border bg-white/[0.03] py-3 text-center text-xl font-semibold tabular-nums outline-none transition-all duration-150 sm:w-12",
            invalid
              ? "border-red-500/60 text-red-300"
              : d
                ? "border-accent/50 text-[var(--color-ink)]"
                : "border-white/[0.10] text-[var(--color-ink)] focus:border-accent/60",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}
