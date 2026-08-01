"use client";

import { cn } from "@/lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  size?: "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "lg" ? "px-8 py-4 text-base" : "px-6 py-3 text-sm",
        variant === "primary" &&
          "bg-accent text-zinc-950 hover:bg-accent-bright hover:shadow-[0_0_32px_rgba(149,191,71,0.35)] active:scale-[0.98]",
        variant === "outline" &&
          "border border-white/15 text-zinc-100 hover:border-white/30 hover:bg-white/5",
        variant === "ghost" && "text-zinc-400 hover:text-zinc-100",
        className,
      )}
      {...props}
    />
  );
}
