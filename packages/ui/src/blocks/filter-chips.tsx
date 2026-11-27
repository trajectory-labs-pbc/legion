import { cn } from "cn";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { textVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";

/** One set filter as a chip that reads `field | operator | value | ×` (LR9). */
function FilterChip({
  field,
  operator,
  value,
  onRemove,
}: {
  field: string;
  operator: string;
  value: ReactNode;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        textVariants({ size: "caption" }),
        "inline-flex h-6 shrink-0 items-center divide-x divide-border rounded-badge border border-border"
      )}
      data-slot="filter-chip"
    >
      <span className="px-2 text-muted-foreground">{field}</span>
      <span className="px-2 text-muted-foreground">{operator}</span>
      <span className={cn(textVariants({ size: "inherit", weight: "medium" }), "px-2")}>
        {value}
      </span>
      <button
        aria-label={`Remove the ${field} filter`}
        className="flex h-full items-center rounded-r-badge px-1.5 text-muted-foreground hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={onRemove}
        type="button"
      >
        <XIcon aria-hidden className="size-3" />
      </button>
    </span>
  );
}

/** The filter row under a view's header: `start` (the search box, the Filter button), then the
 *  chips and what follows them (Clear filters), then `end` at the right. */
function FilterChips({
  start,
  children,
  end,
}: {
  start?: ReactNode;
  children?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <div
      className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2"
      data-slot="filter-chips"
    >
      {start}
      {isDrawn(children) ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      ) : null}
      {isDrawn(end) ? <div className="ml-auto flex shrink-0 items-center gap-2">{end}</div> : null}
    </div>
  );
}

export { FilterChip, FilterChips };
