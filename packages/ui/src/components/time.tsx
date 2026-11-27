import { cn } from "cn";
import type { ComponentProps } from "react";

import {
  formatAge,
  formatAgeWords,
  formatInstant,
  isInstant,
  NO_INSTANT,
} from "#registry/legion/lib/format";
import { textVariants } from "#registry/legion/lib/typography";

/** A past instant as its age at `now` ("5m"), muted and tabular, named in words ("5 minutes ago"),
 *  with the instant itself in its title. It does not tick: the caller renders it again with a
 *  later `now`. An invalid instant shows a dash. */
function Time({
  className,
  value,
  now,
  ...props
}: Omit<ComponentProps<"time">, "aria-label" | "children" | "dateTime" | "title"> & {
  value: Date;
  /** The instant the age is counted to. */
  now: Date;
}) {
  const classes = cn(
    textVariants({ size: "caption", tone: "muted" }),
    "shrink-0 tabular-nums",
    className
  );
  if (!isInstant(value)) {
    return (
      <span data-slot="time" className={classes}>
        {NO_INSTANT}
      </span>
    );
  }
  return (
    <time
      data-slot="time"
      dateTime={value.toISOString()}
      title={formatInstant(value)}
      className={classes}
      {...props}
    >
      {/* The time role takes no aria-label, so the words are hidden text. */}
      <span aria-hidden>{formatAge(value, now)}</span>
      <span className="sr-only">{formatAgeWords(value, now)}</span>
    </time>
  );
}

export { Time };
