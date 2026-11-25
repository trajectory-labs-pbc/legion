import { Badge } from "@legion/ui/components/badge";
import { Button } from "@legion/ui/components/button";
import { NavSurface } from "@legion/ui/components/nav";
import { useQuery } from "@tanstack/react-query";
import { userAgentStateQuery } from "@upstream-dispatch/api/queries";
import { totalUnreadReplies, unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { useInboxCount } from "@upstream-dispatch/features/inbox/useInboxCount";
import { CommandButton } from "@/commands/command-button";
import { PageLink } from "@/navigation/page-link";
import { agents } from "@/pages/agents";
import { inbox } from "@/pages/inbox";

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
  const inboxVariant = inboxCount === 0 ? "secondary" : "default";
  return (
    <NavSurface className="flex items-center justify-between border-b px-3" render={<header />}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <PageLink className="shrink-0 text-lg font-semibold" page={inbox.routes.home}>
          Dispatch
        </PageLink>
        {onInbox ? (
          <Badge variant={inboxVariant}>{inboxLabel}</Badge>
        ) : (
          <>
            <CommandButton commandId="global.inbox-drawer" label="Peek" size="xs" variant="ghost" />
            <Badge render={<PageLink page={inbox.routes.home} />} variant={inboxVariant}>
              {inboxLabel}
            </Badge>
          </>
        )}
        {unread === 0 ? null : (
          <Badge render={<PageLink page={agents.routes.list} />}>
            {unreadRepliesLabel(unread)}
          </Badge>
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
    </NavSurface>
  );
}
