import { Skeleton } from "@legion/ui/components/skeleton";
import { ISSUE_TAB_LABELS } from "@upstream-dispatch/features/issue/issue-tab-list";
import type { ReactNode } from "react";

const ROWS = [0, 1, 2, 3];

function Rows(): ReactNode {
  return (
    <div className="space-y-3">
      {ROWS.map((row) => (
        <Skeleton className="h-4 w-full" key={row} />
      ))}
    </div>
  );
}

/** What main shows while an issue page's code loads: the tabbed page's outline. */
export function IssuePageFallback(): ReactNode {
  return (
    <div aria-busy="true">
      <header className="mb-6 border-b border-border pb-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-3 h-7 w-2/3" />
      </header>
      <div className="mb-4 flex gap-2 overflow-hidden border-b border-border pb-2">
        {ISSUE_TAB_LABELS.map((label) => (
          <Skeleton className="h-5 w-16 shrink-0" key={label} />
        ))}
      </div>
      <Rows />
    </div>
  );
}

/** The outline issue page's loading frame: boxes with no words in them. */
export function IssueFrameFallback(): ReactNode {
  return (
    <div aria-busy="true" className="px-3.5 pt-2 md:px-7">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-2 h-7 w-2/3" />
      <div className="mt-4 mb-4 flex min-w-0 gap-2 overflow-hidden border-b border-border pb-2">
        {ROWS.concat(4).map((box) => (
          <Skeleton className="h-5 w-16 shrink-0" key={box} />
        ))}
      </div>
      <Rows />
    </div>
  );
}
