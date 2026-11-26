import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import type { RefObject } from "react";
import { CommandButton } from "@/commands/command-button";
import { lazyRegion } from "@/loading/lazy-region";
import { AppName } from "./app-name";
import { Sidebar } from "./sidebar";
import type { SignOut } from "./use-sign-out";

/** The sidebar's contents: the name row with search and new issue, the destinations, and the account. */
export function NavigationPanel({
  closeButtonRef,
  compact,
  onClose,
  signOut,
  user,
}: {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  /** Drawn in a drawer, which a Close button ends. */
  compact: boolean;
  onClose: () => void;
  /** Held by the shell, so a refusal outlives the narrow screen's menu. */
  signOut: Pick<SignOut, "start" | "pending" | "error">;
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
      <div className="mt-auto flex flex-col gap-1 pt-4">
        {/* The row keeps its height while the menu's code loads. */}
        <div className="min-h-control-sm">
          <AccountMenu
            login={user.login}
            onNavigate={compact ? onClose : undefined}
            onSignOut={signOut.start}
            pending={signOut.pending}
          />
        </div>
        {signOut.error === undefined ? null : (
          <Alert size="compact" variant="danger">
            <AlertTitle>{signOut.error}</AlertTitle>
            <AlertAction>
              <Button loading={signOut.pending} onClick={signOut.start} size="xs" variant="outline">
                Retry
              </Button>
            </AlertAction>
          </Alert>
        )}
      </div>
    </>
  );
}

const AccountMenu = lazyRegion("the account menu", () => import("./account-menu"), "AccountMenu");
