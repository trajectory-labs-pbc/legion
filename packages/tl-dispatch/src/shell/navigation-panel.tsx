import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import { textVariants } from "@legion/ui/lib/typography";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import type { RefObject } from "react";
import { CommandButton } from "@/commands/command-button";
import { PageLink } from "@/navigation/page-link";
import { people } from "@/pages/people";
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
        <div className="flex h-7 items-center gap-2 pl-2">
          <p
            className={textVariants({
              className: "min-w-0 flex-1 truncate",
              size: "caption",
              tone: "muted",
            })}
          >
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
          <Button loading={signOut.pending} onClick={signOut.start} size="xs" variant="ghost">
            Sign out
          </Button>
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
