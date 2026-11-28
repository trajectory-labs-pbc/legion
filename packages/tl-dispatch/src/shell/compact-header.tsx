import { Button } from "@legion/ui/components/button";
import { NavRow, NavSurface } from "@legion/ui/components/nav";
import { ReadFailure } from "@/data/read-failure";
import { PageLink } from "@/navigation/page-link";
import { routes } from "@/navigation/routes";
import { AppName } from "./app-name";
import { useInboxRowCount } from "./inbox-count";
import { PeekButton } from "./peek-button";
import { RowCountMark } from "./row-count";
import { useAgentsRowCount } from "./sidebar-data";

/**
 * The narrow screen's top bar, one 44 px row: the name, the Inbox and unread agents, and the menu.
 * A failed Inbox count says so on a line below it, since the row has no room for the sentence.
 */
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
  const agentsCount = useAgentsRowCount();
  return (
    <>
      <NavSurface className="flex h-11 shrink-0 items-center gap-1 px-2" render={<header />}>
        {/* On a phone the Inbox link, which goes to the same page, leaves room for the row. */}
        <AppName className="max-sm:hidden" />
        <NavRow
          aria-current={onInbox ? "page" : undefined}
          className="shrink-0"
          render={<PageLink page={routes.inbox.home} />}
          title={inboxCount.label}
        >
          Inbox
          <RowCountMark count={inboxCount} />
        </NavRow>
        {(agentsCount.count ?? 0) === 0 ? null : (
          <NavRow
            className="shrink-0"
            render={<PageLink page={routes.agents.list} />}
            title={agentsCount.label}
          >
            Agents
            <RowCountMark count={agentsCount} />
          </NavRow>
        )}
        <div className="ml-auto flex items-center gap-1">
          {onInbox ? null : <PeekButton />}
          <Button
            aria-expanded={navigationOpen}
            onClick={onOpenNavigation}
            size="sm"
            variant="ghost"
          >
            Menu
          </Button>
        </div>
      </NavSurface>
      {inboxCount.fault === undefined ? null : (
        <NavSurface className="px-2 pb-1" render={<div />}>
          <ReadFailure fault={inboxCount.fault} noun="the Inbox count" />
        </NavSurface>
      )}
    </>
  );
}
