import { ViewHeader as HeaderRow } from "@legion/ui/blocks/view-header";
import { NavRow } from "@legion/ui/components/nav";
import type { ReactElement, ReactNode } from "react";

/** One of a page's views, as a tab of its header: a link to the view. */
export interface ViewTab {
  label: string;
  /** The link the tab draws as, such as a `PageLink`. */
  link: ReactElement;
  /** The view that shows; its tab is the current page. */
  current: boolean;
}

/** One tab: a link to its view, current while the view shows. A page may draw one outside the
 *  header, as the Machines window strip does. */
export function ViewTabLink({ tab }: { tab: ViewTab }): ReactNode {
  return (
    <NavRow aria-current={tab.current ? "page" : undefined} render={tab.link}>
      {tab.label}
    </NavRow>
  );
}

/** A view's header row, with the page's views as tabs that link to each (FR3). */
export function ViewHeader({
  title,
  count,
  tabs = [],
  end,
}: {
  title: string;
  count?: number;
  tabs?: readonly ViewTab[];
  end?: ReactNode;
}): ReactNode {
  return (
    <HeaderRow
      count={count}
      end={end}
      tabs={
        tabs.length === 0 ? undefined : (
          <nav aria-label={`${title} views`} className="flex items-center gap-1">
            {tabs.map((tab) => (
              <ViewTabLink key={tab.label} tab={tab} />
            ))}
          </nav>
        )
      }
      // When the first tab repeats the title, the tab shows it; the h1 keeps it for readers.
      title={tabs[0]?.label === title ? <span className="sr-only">{title}</span> : title}
    />
  );
}
