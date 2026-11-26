import { cn } from "@legion/ui/lib/utils";
import type { ReactNode, RefObject } from "react";
import { CommandButton } from "@/commands/command-button";

/** The inverted L's content panel: a card with the theme's large corner, inset 8 px from the window.
 *  Its content is clipped to the corner; the sticky row above it is not, so the row's strip still
 *  covers the panel's side edges in the inset. The outline issue page frames itself. */
export function ContentPanel({
  children,
  fillsViewport,
  issueFrame,
  marginRail,
  openerRef,
  sidebarFolded,
}: {
  children: ReactNode;
  fillsViewport: boolean;
  issueFrame: boolean;
  /** The margin is folded to its rail at the right edge. */
  marginRail: boolean;
  openerRef?: RefObject<HTMLButtonElement | null>;
  /** The sidebar is folded away, so the panel fills the window and its top row shows the sidebar again. */
  sidebarFolded: boolean;
}) {
  return (
    <div
      className={
        issueFrame
          ? "contents"
          : cn(
              // The inset and the top row are variables, so the margin sheet keeps clear of both (frame.css).
              "flex min-w-0 flex-1 flex-col border-border bg-card [--panel-inset:--spacing(2)] max-md:border-t md:order-2 md:my-(--panel-inset) md:mr-(--panel-inset) md:rounded-lg md:border",
              fillsViewport ? "min-h-0" : "md:min-h-[calc(100dvh-2*var(--panel-inset))]",
              sidebarFolded ? "md:ml-(--panel-inset) [--panel-row:--spacing(11)]" : null,
              marginRail ? "xl:mr-16" : null
            )
      }
      data-testid={issueFrame ? undefined : "content-panel"}
    >
      {sidebarFolded && !issueFrame ? (
        // A sticky row for Show sidebar, with the panel's top corners; its strip hides the page
        // scrolled into the inset above.
        <div
          className="sticky top-(--panel-inset) z-10 flex h-(--panel-row) shrink-0 items-center border-b border-border bg-card px-2 md:rounded-t-lg before:absolute before:-inset-x-px before:bottom-full before:h-(--panel-inset) before:border-b before:border-border before:bg-background"
          data-testid="panel-header"
        >
          <CommandButton
            commandId="global.toggle-sidebar"
            label="Show sidebar"
            ref={openerRef}
            size="icon-sm"
            tooltipSide="bottom"
          />
        </div>
      ) : null}
      <div
        className={
          issueFrame
            ? "contents"
            : cn(
                "flex-1 md:overflow-clip md:rounded-b-lg",
                sidebarFolded ? null : "md:rounded-t-lg",
                fillsViewport ? "flex min-h-0 flex-col xl:flex-row" : "xl:flex"
              )
        }
      >
        {children}
      </div>
    </div>
  );
}
