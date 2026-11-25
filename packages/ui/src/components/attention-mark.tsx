import { cn } from "cn";
import type { ComponentProps } from "react";

import { badgeVariants } from "#registry/legion/ui/badge";

/** The one warning-colour mark: a square chip holding a count, and the name a reader hears. */
function AttentionMark({
  className,
  count,
  label,
  ...props
}: Omit<ComponentProps<"span">, "aria-label" | "children"> & {
  count: number;
  label: string;
}) {
  return (
    <span
      aria-label={label}
      data-slot="attention-mark"
      role="img"
      className={cn(
        badgeVariants({ variant: "warning" }),
        "h-5 min-w-5 rounded-none px-1 py-0 tabular-nums",
        className
      )}
      {...props}
    >
      {count}
    </span>
  );
}

export { AttentionMark };
