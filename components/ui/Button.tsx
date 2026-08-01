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
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold",
        "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "lg" ? "px-8 py-4 text-[15px]" : "px-6 py-3 text-sm",
        variant === "primary" && [
          "bg-accent text-zinc-950",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_20px_-6px_rgba(149,191,71,0.5)]",
          "hover:bg-accent-bright hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_34px_-6px_rgba(149,191,71,0.6)]",
          "active:scale-[0.98]",
        ],
        variant === "outline" && "glass glass-interactive text-zinc-100",
        variant === "ghost" && "text-zinc-400 hover:text-zinc-100",
        className,
      )}
      {...props}
    />
  );
}
