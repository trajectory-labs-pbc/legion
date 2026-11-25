import { cn } from "cn";
import type { ComponentProps } from "react";

/** A row's count: a muted number, or the "needs you" mark when it waits on the reader; none at 0. */
function Count({
  className,
  needsYou = false,
  value,
  ...props
}: Omit<ComponentProps<"span">, "children"> & { value: number; needsYou?: boolean }) {
  if (value === 0) return null;
  return (
    <span
      data-needs-you={needsYou ? "" : undefined}
      data-slot="count"
      className={cn(
        "shrink-0 text-xs tabular-nums",
        needsYou
          ? "min-w-5 border border-warning-border bg-warning-tint px-1 text-center font-medium text-warning"
          : "text-muted-foreground",
        className
      )}
      {...props}
    >
      {value}
    </span>
  );
}

export { Count };
