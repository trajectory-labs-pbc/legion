import { cn } from "cn";
import { ChevronRightIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { headingVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";
import { CollapsibleTrigger } from "#registry/legion/ui/collapsible";
import { Count } from "#registry/legion/ui/count";

/** A group's header in a list: one 36 px line, sticky at the list's top, that folds its group
 *  (LR7). It shows the fold mark, the group's glyph, its name and its count, and `end` at the
 *  right. It sits in the group's `Collapsible`, which holds whether the group is open. */
function GroupHeader({
  title,
  count,
  glyph,
  end,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children" | "title"> & {
  title: ReactNode;
  count?: number;
  glyph?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex h-list-row-1 shrink-0 items-center gap-2 bg-muted px-3",
        className
      )}
      data-slot="group-header"
      {...props}
    >
      <CollapsibleTrigger className="group/fold flex min-w-0 items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground group-data-panel-open/fold:rotate-90"
        />
        {isDrawn(glyph) ? <span className="flex shrink-0">{glyph}</span> : null}
        <span className={cn(headingVariants({ size: "group" }), "min-w-0 truncate")}>{title}</span>
        {count === undefined ? null : <Count value={count} />}
      </CollapsibleTrigger>
      {isDrawn(end) ? <div className="ml-auto flex shrink-0 items-center gap-1">{end}</div> : null}
    </div>
  );
}

export { GroupHeader };
