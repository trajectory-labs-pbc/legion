import { cn } from "cn";
import type { ComponentProps } from "react";

/** The one warning-colour mark: a square chip with an optional count, and the name a reader hears. */
function AttentionMark({
  className,
  count,
  label,
  size = "row",
  ...props
}: Omit<ComponentProps<"span">, "aria-label" | "children"> & {
  count?: number;
  label: string;
  size?: "row" | "header";
}) {
  return (
    <span
      aria-label={label}
      data-size={size}
      data-slot="attention-mark"
      role="img"
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-warning-border bg-warning-tint px-1 font-medium text-warning tabular-nums",
        size === "row" ? "h-5 min-w-5 text-xs" : "h-6 min-w-6 text-sm",
        className
      )}
      {...props}
    >
      {count ?? <span aria-hidden className="size-1.5 bg-warning" />}
    </span>
  );
}

export { AttentionMark };
