import { Button } from "@legion/ui/components/button";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import type { RefObject } from "react";
import { CommandButton } from "@/commands/command-button";
import { PageLink } from "@/navigation/page-link";
import { inbox } from "@/pages/inbox";
import { people } from "@/pages/people";
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
        <PageLink
          className="mr-auto truncate rounded-md px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          onClick={onClose}
          page={inbox.routes.home}
        >
          Dispatch
        </PageLink>
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
            size="icon-sm"
            tooltipSide="bottom"
          />
        )}
      </div>
      <Sidebar onNavigate={compact ? onClose : undefined} peek={!compact} user={user} />
      <div className="mt-auto flex flex-col pt-4 text-xs">
        <div className="flex h-7 items-center gap-2 pl-2">
          <p className="min-w-0 flex-1 truncate text-muted-foreground">
            Signed in as{" "}
            <PageLink
              className="text-foreground underline underline-offset-4"
              onClick={onClose}
              page={people.routes.person}
              params={{ login: user.login }}
            >
              {user.login}
            </PageLink>
          </p>
          <Button disabled={signOut.pending} onClick={signOut.start} size="xs" variant="ghost">
            Sign out
          </Button>
        </div>
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
