import { cn } from "@/lib/cn";

export function GlassCard({
  className,
  deep = false,
  children,
}: {
  className?: string;
  deep?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(deep ? "glass-deep" : "glass", "rounded-3xl", className)}>
      {children}
    </div>
  );
}
