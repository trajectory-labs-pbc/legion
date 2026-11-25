import { cn } from "cn";
import type { ComponentProps } from "react";

/** The one warning-colour mark: a dot, an optional count, and the name a reader hears. */
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
        "inline-flex shrink-0 items-center gap-1 font-medium text-warning tabular-nums",
        size === "row" ? "text-xs" : "text-sm",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full bg-warning", size === "row" ? "size-1.5" : "size-2")}
      />
      {count}
    </span>
  );
}

export { AttentionMark };
