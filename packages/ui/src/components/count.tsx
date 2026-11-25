import { cn } from "cn";
import type { ComponentProps } from "react";

import { textVariants } from "#registry/legion/lib/typography";

/** A row's number at its right edge: muted and tabular; none at zero. */
function Count({
  className,
  value,
  ...props
}: Omit<ComponentProps<"span">, "children"> & { value: number }) {
  if (value === 0) return null;
  return (
    <span
      data-slot="count"
      className={cn(
        textVariants({ size: "caption", tone: "muted" }),
        "shrink-0 tabular-nums",
        className
      )}
      {...props}
    >
      {value}
    </span>
  );
}

export { Count };
