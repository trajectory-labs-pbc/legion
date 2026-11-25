import { Button } from "@legion/ui/components/button";
import { Count } from "@legion/ui/components/count";
import { NavRow, NavSurface } from "@legion/ui/components/nav";
import { useQuery } from "@tanstack/react-query";
import { userAgentStateQuery } from "@upstream-dispatch/api/queries";
import { totalUnreadReplies, unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { NeedsYouMark } from "@/features/needs-you";
import { PageLink } from "@/navigation/page-link";
import { agents } from "@/pages/agents";
import { inbox } from "@/pages/inbox";
import { useInboxRowCount } from "./inbox-count";
import { PeekButton } from "./peek-button";

/** The narrow screen's top bar, one 44 px row: the name, the Inbox and unread agents, and the menu. */
export function CompactHeader({
  navigationOpen,
  onInbox,
  onOpenNavigation,
}: {
  navigationOpen: boolean;
  onInbox: boolean;
  onOpenNavigation: () => void;
}) {
  const inboxCount = useInboxRowCount();
  const unread = totalUnreadReplies(useQuery(userAgentStateQuery()).data);
  return (
    <NavSurface className="flex h-11 shrink-0 items-center gap-1 px-2" render={<header />}>
      {/* On a phone the Inbox link, which goes to the same page, leaves room for the row. */}
      <PageLink
        className="shrink-0 px-2 text-sm font-semibold max-sm:hidden"
        page={inbox.routes.home}
      >
        Dispatch
      </PageLink>
      <NavRow
        aria-current={onInbox ? "page" : undefined}
        className="shrink-0"
        render={<PageLink page={inbox.routes.home} />}
      >
        Inbox
        {inboxCount.needsYou ? (
          <NeedsYouMark count={inboxCount.count ?? 0} />
        ) : (
          <Count title={inboxCount.label} value={inboxCount.count ?? 0} />
        )}
      </NavRow>
      {unread === 0 ? null : (
        <NavRow
          className="shrink-0"
          render={<PageLink page={agents.routes.list} />}
          title={unreadRepliesLabel(unread)}
        >
          Agents
          <Count value={unread} />
        </NavRow>
      )}
      <div className="ml-auto flex items-center gap-1">
        {onInbox ? null : <PeekButton />}
        <Button
          aria-expanded={navigationOpen}
          aria-label="Open navigation"
          onClick={onOpenNavigation}
          size="sm"
          variant="ghost"
        >
          Menu
        </Button>
      </div>
    </NavSurface>
  );
}
