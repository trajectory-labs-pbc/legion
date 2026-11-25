import { cn } from "@legion/ui/lib/utils";
import type { ComponentProps } from "react";

/** A row's count as a muted number; nothing at zero. */
export function RowCount({
  className,
  value,
  ...props
}: Omit<ComponentProps<"span">, "children"> & { value: number }) {
  if (value === 0) return null;
  return (
    <span
      className={cn("shrink-0 text-xs text-muted-foreground tabular-nums", className)}
      {...props}
    >
      {value}
    </span>
  );
}
