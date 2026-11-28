import { cn } from "cn";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { textVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";
import { Button } from "#registry/legion/ui/button";

/** One set filter as a chip that reads `field | operator | value | ×` (LR9). */
function FilterChip({
  field,
  operator,
  value,
  onRemove,
}: {
  field: string;
  operator: string;
  value: string;
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
      <span className={cn(textVariants({ size: "caption", weight: "medium" }), "px-2")}>
        {value}
      </span>
      <Button
        aria-label={`Remove the filter ${field} ${operator} ${value}`}
        className="h-full rounded-l-none rounded-r-badge text-muted-foreground"
        onClick={onRemove}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <XIcon aria-hidden />
      </Button>
    </span>
  );
}

/** The filter row under a view's header: its children (the search box, the Filter button, the
 *  chips, Clear filters), then `end` at the right. */
function FilterChips({ children, end }: { children?: ReactNode; end?: ReactNode }) {
  return (
    <div
      className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2"
      data-slot="filter-chips"
    >
      {children}
      {isDrawn(end) ? <div className="ml-auto flex shrink-0 items-center gap-2">{end}</div> : null}
    </div>
  );
}

export { FilterChip, FilterChips };
