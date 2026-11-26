import { cn } from "cn";
import type { ComponentProps } from "react";

import { formatAge, formatInstant } from "#registry/legion/lib/format";
import { textVariants } from "#registry/legion/lib/typography";

/** An instant as its age at `now`, muted and tabular, with the instant itself in its title. It does
 *  not tick: the caller renders it again with a later `now`. */
function Time({
  className,
  value,
  now,
  ...props
}: Omit<ComponentProps<"time">, "children" | "dateTime" | "title"> & {
  value: Date;
  /** The instant the age is counted to. */
  now: Date;
}) {
  return (
    <time
      data-slot="time"
      dateTime={value.toISOString()}
      title={formatInstant(value)}
      className={cn(
        textVariants({ size: "caption", tone: "muted" }),
        "shrink-0 tabular-nums",
        className
      )}
      {...props}
    >
      {formatAge(value, now)}
    </time>
  );
}

export { Time };
