import { NavSurface } from "@legion/ui/components/nav";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@legion/ui/components/sheet";
import type { ReactNode, RefObject } from "react";

import { GLOBAL_KEYS_ATTRIBUTE } from "@/commands/focused-overlay";

/** The navigation as a drawer from the left, over a scrim. The global keys still run in it. Loaded when it first opens. */
export function NavigationDrawerView({
  children,
  initialFocus,
  onClose,
  open,
}: {
  children: ReactNode;
  /** The control that takes the focus when the drawer opens. */
  initialFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
}) {
  return (
    <Sheet
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <SheetContent
        {...{ [GLOBAL_KEYS_ATTRIBUTE]: "" }}
        className="w-80 max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto sm:max-w-80"
        initialFocus={initialFocus}
        showCloseButton={false}
        side="left"
      >
        <NavSurface className="flex min-h-full flex-col p-5" render={<div />}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            The pages of Dispatch, and your pins.
          </SheetDescription>
          {children}
        </NavSurface>
      </SheetContent>
    </Sheet>
  );
}
