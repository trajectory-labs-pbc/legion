import { cn } from "cn";
import type { ReactNode } from "react";

import { headerBarClass, headerEndClass } from "#registry/legion/lib/header-styles";
import { headingVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";
import { SurfaceTitle } from "#registry/legion/ui/heading";

/** A record's header (IV4, IV5). With a breadcrumb: a 44 px bar with the breadcrumb at the left and
 *  `end` at the right, then the title under it. Without one, as in a peek: the title in the bar,
 *  with `end` beside it. The title is the surface's title at 20 px and wraps, never truncating.
 *  Facts go in the properties panel, not in more rows here. */
function RecordHeader({
  breadcrumb,
  title,
  leading,
  end,
}: {
  /** The way back to the list, a `Breadcrumb`. */
  breadcrumb?: ReactNode;
  /** The record's name: the page's h1, or a peek's h2. */
  title: ReactNode;
  /** The record's glyph before the title, outside its name. */
  leading?: ReactNode;
  /** The record's actions and its menu, at the right of the bar. */
  end?: ReactNode;
}) {
  const heading = (
    <div className="flex min-w-0 items-start gap-2">
      {isDrawn(leading) ? (
        // One title line high, so the glyph centres on the title's first line.
        <span className={cn(headingVariants({ size: "page" }), "flex h-lh shrink-0 items-center")}>
          {leading}
        </span>
      ) : null}
      <SurfaceTitle className="min-w-0" size="page">
        {title}
      </SurfaceTitle>
    </div>
  );
  const endPart = isDrawn(end) ? <div className={headerEndClass}>{end}</div> : null;
  if (!isDrawn(breadcrumb)) {
    return (
      // The bar grows with a title that wraps; its controls stay on the first line.
      <header
        className={cn(headerBarClass, "h-auto min-h-11 items-start py-2")}
        data-slot="record-header"
      >
        {heading}
        {endPart}
      </header>
    );
  }
  return (
    <header className="flex shrink-0 flex-col" data-slot="record-header">
      <div className={headerBarClass}>
        <div className="min-w-0">{breadcrumb}</div>
        {endPart}
      </div>
      <div className="px-6 pt-6 pb-3">{heading}</div>
    </header>
  );
}

export { RecordHeader };
