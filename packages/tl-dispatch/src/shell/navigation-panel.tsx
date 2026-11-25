import { Button } from "@legion/ui/components/button";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import type { RefObject } from "react";
import { CommandButton } from "@/commands/command-button";
import { PageLink } from "@/navigation/page-link";
import { inbox } from "@/pages/inbox";
import { Sidebar } from "./sidebar";
import type { SignOut } from "./use-sign-out";

/** The sidebar's contents: the name, search and new issue, the destinations, and the account. */
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
      <div className="flex items-center justify-between gap-2">
        <PageLink
          className="rounded-md text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={onClose}
          page={inbox.routes.home}
        >
          Dispatch
        </PageLink>
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
            size="icon-sm"
            tooltipSide="right"
          />
        )}
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <CommandButton
          className="w-full justify-start"
          commandId="global.search"
          tooltipSide="right"
          label="Search"
          variant="outline"
        />
        <CommandButton
          className="w-full justify-start"
          commandId="global.create"
          tooltipSide="right"
          label="New issue"
          variant="ghost"
        />
      </div>
      <Sidebar onNavigate={compact ? onClose : undefined} user={user} />
      <div className="mt-auto flex flex-col items-start gap-1 border-t border-sidebar-border pt-4 text-sm">
        <p className="px-2 text-muted-foreground">Signed in as {user.login}</p>
        <Button disabled={signOut.pending} onClick={signOut.start} size="xs" variant="link">
          Sign out
        </Button>
        {signOut.error === undefined ? null : (
          <p className="px-2 text-danger" role="alert">
            {signOut.error}{" "}
            <Button onClick={signOut.start} size="xs" variant="link">
              Retry
            </Button>
          </p>
        )}
      </div>
    </>
  );
}
