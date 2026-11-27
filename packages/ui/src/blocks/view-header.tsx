import type { ReactNode } from "react";
import { Count } from "#registry/legion/ui/count";
import { SurfaceTitle } from "#registry/legion/ui/heading";

/** A view's one header row, 44 px with a line under it (FR3): at the left the frame's control, the
 *  title, its count and the view's tabs; at the right the view's controls. */
function ViewHeader({
  title,
  count,
  start,
  tabs,
  end,
}: {
  /** The page's title, its h1. */
  title: ReactNode;
  /** The view's row count; none at zero. */
  count?: number;
  /** The frame's control before the title, such as Show sidebar. */
  start?: ReactNode;
  tabs?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <header
      className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3"
      data-slot="view-header"
    >
      {start}
      <SurfaceTitle className="truncate" size="group">
        {title}
      </SurfaceTitle>
      {count === undefined ? null : <Count value={count} />}
      {tabs === undefined ? null : <div className="flex min-w-0 items-center gap-1">{tabs}</div>}
      {end === undefined ? null : (
        <div className="ml-auto flex shrink-0 items-center gap-1">{end}</div>
      )}
    </header>
  );
}

export { ViewHeader };
