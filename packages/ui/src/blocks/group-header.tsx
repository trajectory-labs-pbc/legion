import { cn } from "cn";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { headingVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";
import { Count } from "#registry/legion/ui/count";

/** A group's header in a list: one 36 px line, sticky at the list's top, that folds its group
 *  (LR7). It shows the fold mark, the group's glyph, its name and its count, and `end` at the
 *  right. */
function GroupHeader({
  title,
  count,
  glyph,
  end,
  open,
  onOpenChange,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children" | "title"> & {
  title: ReactNode;
  count?: number;
  glyph?: ReactNode;
  end?: ReactNode;
  /** Whether the group's rows show. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const Fold = open ? ChevronDownIcon : ChevronRightIcon;
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex h-list-row-1 shrink-0 items-center gap-2 bg-muted px-3",
        className
      )}
      data-slot="group-header"
      {...props}
    >
      <button
        aria-expanded={open}
        className="flex min-w-0 items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <Fold aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        {isDrawn(glyph) ? <span className="flex shrink-0">{glyph}</span> : null}
        <span className={cn(headingVariants({ size: "group" }), "min-w-0 truncate")}>{title}</span>
        {count === undefined ? null : <Count value={count} />}
      </button>
      {isDrawn(end) ? <div className="ml-auto flex shrink-0 items-center gap-1">{end}</div> : null}
    </div>
  );
}

export { GroupHeader };
