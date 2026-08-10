"use client";

import { cn } from "@/lib/cn";

// Buttons, following Apple's three prominences rather than a web palette.
//
//   primary    the one tinted control on a screen. Per the Liquid Glass tint
//              rule, "when every element is tinted, nothing stands out" — so
//              a screen gets exactly one of these, and the accent appears
//              nowhere else in the interface.
//   secondary  a neutral fill. Present, obviously tappable, not competing.
//   ghost      text only, for the third-choice action.
//
// CAPSULE, and its radius is half the height rather than a fixed number —
// the shape system's rule for phone-scale controls. `rounded-full` gives
// exactly that at any size, which is why no size here carries its own radius.
//
// THE PRESS IS A SHRINK, NOT A LIFT. A hover-lift is a desktop-web idiom
// that does not exist on touch, so the previous outline variant simply had
// no pressed state on a phone — the majority of this product's traffic. A
// scale-down reads as physical and works on every input.

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: Props) {
  // "outline" was the old name for what is now `secondary`. Kept as an alias
  // so call sites did not all have to change in the same commit.
  const kind = variant === "outline" ? "secondary" : variant;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full",
        // A capsule's radius is half its height, so a label that wraps turns
        // the control into an ellipse — which is exactly what happened to the
        // hero CTA the moment the German string got long enough to break.
        // Capsules take one line; if a label needs two, it needs a rectangle.
        "whitespace-nowrap",
        "font-semibold tracking-[-0.006em]",
        "transition-[background-color,color,transform,opacity] duration-[180ms]",
        "ease-[cubic-bezier(0.28,0.9,0.3,1.06)]",
        "active:scale-[0.96] motion-reduce:active:scale-100",
        "disabled:pointer-events-none disabled:opacity-35",
        size === "lg" ? "px-7 py-3.5 text-[16px]" : "px-5 py-2.5 text-[15px]",

        kind === "primary" && [
          "bg-[var(--color-accent)] text-[var(--color-accent-ink)]",
          "hover:bg-[var(--color-accent-bright)]",
          "active:bg-[var(--color-accent-press)]",
        ],

        // A fill, not a material: this sits ON content, and content never
        // gets glass. See the never-glass-on-glass note in globals.css.
        kind === "secondary" && [
          "bg-white/[0.07] text-[var(--color-ink)]",
          "hover:bg-white/[0.11] active:bg-white/[0.14]",
        ],

        kind === "ghost" && [
          "text-[var(--color-ink-secondary)]",
          "hover:text-[var(--color-ink)] hover:bg-white/[0.05]",
        ],

        className,
      )}
      {...props}
    />
  );
}
