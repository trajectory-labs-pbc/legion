import { Button } from "@legion/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { userAgentStateQuery } from "@upstream-dispatch/api/queries";
import { totalUnreadReplies, unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { useInboxCount } from "@upstream-dispatch/features/inbox/useInboxCount";
import { CommandButton } from "@/commands/command-button";
import { PageLink } from "@/navigation/page-link";
import { agents } from "@/pages/agents";
import { inbox } from "@/pages/inbox";

const CHIP =
  "rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-focus";

/** The narrow screen's top bar: the name, the counts that need the reader, and the menu. */
export function CompactHeader({
  navigationOpen,
  onInbox,
  onOpenNavigation,
}: {
  navigationOpen: boolean;
  onInbox: boolean;
  onOpenNavigation: () => void;
}) {
  const inboxCount = useInboxCount();
  const unread = totalUnreadReplies(useQuery(userAgentStateQuery()).data);
  const inboxLabel = inboxCount === 0 ? "Inbox" : `Inbox ${inboxCount}`;
  const inboxClass = `${CHIP} ${inboxCount === 0 ? "bg-sidebar-accent" : "bg-sidebar-primary text-sidebar-primary-foreground"}`;
  return (
    <header className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <PageLink className="shrink-0 text-lg font-semibold" page={inbox.routes.home}>
          Dispatch
        </PageLink>
        {onInbox ? (
          <span className={inboxClass}>{inboxLabel}</span>
        ) : (
          <>
            <CommandButton commandId="global.inbox-drawer" label="Peek" size="xs" variant="ghost" />
            <PageLink className={inboxClass} page={inbox.routes.home}>
              {inboxLabel}
            </PageLink>
          </>
        )}
        {unread === 0 ? null : (
          <PageLink
            className={`${CHIP} bg-sidebar-primary text-sidebar-primary-foreground`}
            page={agents.routes.list}
          >
            {unreadRepliesLabel(unread)}
          </PageLink>
        )}
      </div>
      <Button
        aria-expanded={navigationOpen}
        aria-label="Open navigation"
        onClick={onOpenNavigation}
        size="sm"
        variant="ghost"
      >
        Menu
      </Button>
    </header>
  );
}
