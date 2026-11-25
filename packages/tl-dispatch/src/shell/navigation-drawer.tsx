import { cn } from "@legion/ui/lib/utils";
import type { ReactNode, RefObject } from "react";
import { SIDEBAR_SURFACE } from "./sidebar-surface";

/** The navigation as a modal drawer over a scrim. */
export function NavigationDrawer({
  children,
  containerRef,
  onClose,
}: {
  children: ReactNode;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-20 bg-scrim/50" onClick={onClose} />
      <aside
        aria-label="Navigation"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto border-r p-5",
          SIDEBAR_SURFACE
        )}
        ref={containerRef}
        role="dialog"
      >
        {children}
      </aside>
    </>
  );
}
