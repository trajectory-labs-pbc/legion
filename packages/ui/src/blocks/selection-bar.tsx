import { cn } from "cn";
import type { ReactNode } from "react";

import { textVariants } from "#registry/legion/lib/typography";

/** The bar over the bottom of a list column while rows are selected (LR5, R6): the count, a
 *  message such as a refusal in an always-present status region, then the actions at the right.
 *  Its column is `relative`, and its scroller keeps a bottom padding of the bar's 44 px, so the
 *  bar moves no row. */
function SelectionBar({
  count,
  message,
  children,
}: {
  count: number;
  message?: ReactNode;
  /** The actions, each with its key. */
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset's legend cannot sit in a flex row
    <div
      aria-label={`${count} selected`}
      className="absolute inset-x-0 bottom-0 z-raised flex h-11 items-center gap-3 border-t border-border bg-card px-3"
      data-slot="selection-bar"
      role="group"
    >
      <span className={cn(textVariants({ weight: "medium" }), "shrink-0 tabular-nums")}>
        {count} selected
      </span>
      <span className={cn(textVariants(), "min-w-0 truncate")} role="status">
        {message}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}

export { SelectionBar };
