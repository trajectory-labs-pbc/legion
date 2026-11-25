import { cn } from "cn";
import type { ComponentProps } from "react";

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
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center border border-warning-border bg-warning-tint px-1 text-xs font-medium text-warning tabular-nums",
        className
      )}
      {...props}
    >
      {count}
    </span>
  );
}

export { AttentionMark };
