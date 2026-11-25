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
              // The inset is a variable, so the margin sheet inside keeps it too (frame.css).
              "min-w-0 flex-1 border-border bg-card [--panel-inset:--spacing(2)] max-md:border-t md:order-2 md:my-(--panel-inset) md:mr-(--panel-inset) md:border",
              fillsViewport
                ? "flex min-h-0 flex-col xl:flex-row"
                : "md:min-h-[calc(100dvh-2*var(--panel-inset))] xl:flex",
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
