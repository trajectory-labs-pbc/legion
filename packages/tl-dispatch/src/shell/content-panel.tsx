import { cn } from "@legion/ui/lib/utils";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { CommandButton } from "@/commands/command-button";

/** Whether the sticky row has left its place at the panel's top: the page scrolled under it. The
 *  mark before the row stays where the row would be, and rises above the row's line with the page. */
function useStuck(
  mark: RefObject<HTMLElement | null>,
  row: RefObject<HTMLElement | null>,
  on: boolean
): boolean {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const at = mark.current;
    if (!on || at === null || row.current === null) return;
    const line = Number.parseFloat(getComputedStyle(row.current).top) || 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setStuck(!entry.isIntersecting && entry.boundingClientRect.top < line);
      },
      { rootMargin: `${-line}px 0px 0px 0px` }
    );
    observer.observe(at);
    return () => {
      observer.disconnect();
      // A row drawn again starts at rest, not stuck as it last was.
      setStuck(false);
    };
  }, [mark, row, on]);
  return on && stuck;
}

/** The inverted L's content panel: a card with the theme's large corner, inset 8 px from the window.
 *  Its content is clipped to the corner; the sticky row above it is not. At rest the row has the
 *  panel's top corners; stuck, it is square, and its strip hides the page in the inset and draws
 *  the panel's top edge across the side edges. The outline issue page frames itself. */
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
  const mark = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const stuck = useStuck(mark, row, sidebarFolded && !issueFrame);
  return (
    <div
      // The issue frame keeps both boxes, drawn as their contents, so main and the margin stay
      // mounted when the reader switches it on or off.
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
        <>
          <div aria-hidden ref={mark} />
          {/* A sticky row for Show sidebar. Its strip is drawn only while it is stuck. */}
          <div
            className="sticky top-(--panel-inset) z-raised flex h-(--panel-row) shrink-0 items-center border-b border-border bg-card px-2 md:rounded-t-lg md:data-stuck:rounded-t-none before:absolute before:-inset-x-(--border-width) before:bottom-full before:hidden before:h-(--panel-inset) before:border-b before:border-border before:bg-background data-stuck:before:block"
            data-stuck={stuck || undefined}
            data-testid="panel-header"
            ref={row}
          >
            <CommandButton
              commandId="global.toggle-sidebar"
              label="Show sidebar"
              ref={openerRef}
              size="icon-sm"
              tooltipSide="bottom"
            />
          </div>
        </>
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
