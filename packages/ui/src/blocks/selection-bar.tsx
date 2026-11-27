import { cn } from "cn";
import { type ReactNode, useId } from "react";

import { textVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";

/** The bar over the bottom of a list column while rows are selected (LR5, R6): the count, a
 *  message such as a refusal, then the actions at the right. Its column is `relative`, and its
 *  scroller keeps a bottom padding of the bar's 44 px, so the bar moves no row. */
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
  const countId = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset's legend cannot sit in a flex row
    <div
      aria-labelledby={countId}
      className="absolute inset-x-0 bottom-0 z-10 flex h-11 items-center gap-3 border-t border-border bg-card px-3"
      data-slot="selection-bar"
      role="group"
    >
      <span
        className={cn(textVariants({ weight: "medium" }), "shrink-0 tabular-nums")}
        id={countId}
      >
        {count} selected
      </span>
      {isDrawn(message) ? (
        <span className={cn(textVariants(), "min-w-0 truncate")}>{message}</span>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}

export { SelectionBar };
