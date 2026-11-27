import type { ReactNode } from "react";
import { headerBarClass, headerEndClass } from "#registry/legion/lib/header-styles";
import { isDrawn } from "#registry/legion/lib/utils";
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
    <header className={headerBarClass} data-slot="view-header">
      {start}
      <SurfaceTitle className="truncate" size="group">
        {title}
      </SurfaceTitle>
      {count === undefined ? null : <Count value={count} />}
      {isDrawn(tabs) ? (
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">{tabs}</div>
      ) : null}
      {isDrawn(end) ? <div className={headerEndClass}>{end}</div> : null}
    </header>
  );
}

export { ViewHeader };
