import { cn } from "@legion/ui/lib/utils";
import type { ReactNode } from "react";

/** The inverted L's content panel: a card inset 8 px beside the sidebar. The outline issue page frames itself. */
export function ContentPanel({
  children,
  fillsViewport,
  issueFrame,
  marginRail,
  sidebarFolded,
}: {
  children: ReactNode;
  fillsViewport: boolean;
  issueFrame: boolean;
  /** The margin is folded to its rail at the right edge. */
  marginRail: boolean;
  /** The sidebar is folded to its rail at the left edge. */
  sidebarFolded: boolean;
}) {
  return (
    <div
      className={
        issueFrame
          ? "contents"
          : cn(
              "min-w-0 flex-1 border-border bg-card max-md:border-t md:order-2 md:my-2 md:mr-2 md:border",
              fillsViewport
                ? "flex min-h-0 flex-col xl:flex-row"
                : "md:min-h-[calc(100dvh-1rem)] xl:flex",
              sidebarFolded ? "md:ml-14" : null,
              marginRail ? "xl:mr-16" : null
            )
      }
      data-testid={issueFrame ? undefined : "content-panel"}
    >
      {children}
    </div>
  );
}
