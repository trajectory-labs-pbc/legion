import { Button } from "@legion/ui/components/button";
import type { RefObject } from "react";
import { CommandButton } from "@/commands/command-button";
import type { AuthenticatedUser } from "@/data/session";
import { lazyRegion } from "@/loading/lazy-region";
import { AppName } from "./app-name";
import { Sidebar } from "./sidebar";

/** The sidebar's contents: the name row with search and new issue, the destinations, and the account. */
export function NavigationPanel({
  closeButtonRef,
  compact,
  onClose,
  user,
}: {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  /** Drawn in a drawer, which a Close button ends. */
  compact: boolean;
  onClose: () => void;
  user: AuthenticatedUser;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-1">
        <AppName className="mr-auto" onClick={onClose} />
        <CommandButton
          commandId="global.search"
          label="Search"
          size="icon-sm"
          tooltipSide="bottom"
        />
        <CommandButton
          commandId="global.create"
          label="New issue"
          size="icon-sm"
          tooltipSide="bottom"
        />
        {compact ? (
          <Button
            aria-label="Close navigation"
            onClick={onClose}
            ref={closeButtonRef}
            size="sm"
            variant="ghost"
          >
            Close
          </Button>
        ) : (
          <CommandButton
            commandId="global.toggle-sidebar"
            label="Hide sidebar"
            ref={closeButtonRef}
            size="icon-sm"
            tooltipSide="bottom"
          />
        )}
      </div>
      <Sidebar onNavigate={compact ? onClose : undefined} peek={!compact} user={user} />
      <div className="mt-auto pt-4">
        {/* The row keeps its height while the menu's code loads. */}
        <div className="min-h-control-sm">
          <AccountMenu login={user.login} onNavigate={compact ? onClose : undefined} />
        </div>
      </div>
    </>
  );
}

const AccountMenu = lazyRegion("the account menu", () => import("./account-menu"), "AccountMenu");
