import * as React from "react";
import { cn } from "~/lib/utils";

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "outline" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
        variant === "default" &&
          "border-transparent bg-[var(--accent)] text-[var(--on-accent)]",
        variant === "secondary" &&
          "border-transparent bg-[var(--surface-hover)] text-[var(--text-secondary)]",
        variant === "outline" &&
          "border-[var(--border-strong)] text-[var(--text-secondary)]",
        variant === "success" &&
          "border-transparent bg-[var(--success-glow)] text-[var(--success)]",
        variant === "warning" &&
          "border-transparent bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] text-[var(--warning)]",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
