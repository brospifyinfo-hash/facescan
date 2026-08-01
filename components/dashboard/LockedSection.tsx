"use client";

import { cn } from "@/lib/cn";

/**
 * Wraps real rendered content and blurs it while locked. The content behind
 * the blur is the user's actual analysis — the curiosity gap is honest
 * because there's a genuine result under there.
 */
export function LockedSection({
  locked,
  children,
  className,
}: {
  locked: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!locked) return <div className={className}>{children}</div>;

  return (
    <div
      className={cn("pointer-events-none select-none", className)}
      aria-hidden
      // Content is inert while locked; the unlock CTA is the only affordance.
      inert
    >
      <div className="blur-[9px] saturate-75">{children}</div>
    </div>
  );
}
