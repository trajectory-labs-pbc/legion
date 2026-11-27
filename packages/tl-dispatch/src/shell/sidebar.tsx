import { Button } from "@legion/ui/components/button";
import { Count } from "@legion/ui/components/count";
import { NavRow } from "@legion/ui/components/nav";
import { textVariants } from "@legion/ui/lib/typography";
import { cn } from "@legion/ui/lib/utils";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { AgentName } from "@upstream-dispatch/features/refs/AgentName";
import { PinIcon } from "lucide-react";
import type { ReactNode } from "react";
import { HotkeyTooltip, LabelTooltip } from "@/commands/hotkey-tooltip";
import { navCommandName } from "@/commands/nav";
import { useCommand } from "@/commands/use-command";
import { ReadFailure } from "@/features/read-failure";
import { PageLink } from "@/navigation/page-link";
import { agents } from "@/pages/agents";
import { issue } from "@/pages/issue";
import { project } from "@/pages/project";
import { FoldSection } from "./fold-section";
import { PeekButton } from "./peek-button";
import { CountRetry, RowCountMark, retryableFaultOf } from "./row-count";

import {
  type SectionRead,
  type SidebarAgent,
  type SidebarData,
  type SidebarItem,
  usePinnedAgent,
  useSidebarData,
} from "./sidebar-data";

function PinnedAgentRow({
  agent,
  onNavigate,
  replace,
}: {
  agent: SidebarAgent;
  onNavigate: (() => void) | undefined;
  replace: boolean;
}) {
  const { name, viewState, unpin } = usePinnedAgent(agent.sessionId);
  const unpinLabel = `Unpin ${name} from the sidebar`;
  return (
    <li className="flex items-center gap-1">
      <NavRow
        aria-current={agent.selected ? "page" : undefined}
        className="min-w-0 flex-1"
        render={
          <PageLink
            onClick={onNavigate}
            page={agents.routes.live}
            params={{ sessionId: agent.sessionId }}
            replace={replace}
          />
        }
      >
        <span className="contents" data-upstream-view>
          <AgentName
            className="min-w-0 flex-1 truncate"
            kind="static"
            sessionId={agent.sessionId}
            storedTitle={undefined}
          />
        </span>
        <Count title={unreadRepliesLabel(agent.unread)} value={agent.unread} />
        <span className={textVariants({ className: "shrink-0", size: "caption", tone: "muted" })}>
          {viewState}
        </span>
      </NavRow>
      <LabelTooltip label={unpinLabel} side="right">
        <Button aria-label={unpinLabel} aria-pressed onClick={unpin} size="icon-xs" variant="ghost">
          <PinIcon aria-hidden className="fill-current" />
        </Button>
      </LabelTooltip>
    </li>
  );
}

function ItemRows({
  items,
  onNavigate,
  page,
}: {
  items: readonly SidebarItem[];
  onNavigate: (() => void) | undefined;
  page: typeof issue.routes.issue | typeof project.routes.overview;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.key}>
          <NavRow
            aria-current={item.current ? "page" : undefined}
            render={<PageLink onClick={onNavigate} page={page} params={{ key: item.key }} />}
          >
            <span className={textVariants({ className: "shrink-0", weight: "medium" })}>
              {item.key}
            </span>
            <span className="truncate text-muted-foreground">{item.text}</span>
            <Count className="ml-auto" value={item.openAsks} />
          </NavRow>
        </li>
      ))}
    </ul>
  );
}

/**
 * A folded section of rows, drawn only once it has some: a section that shows and then leaves
 * would move every row under it. A failed read still says so, and keeps saying so while Retry runs.
 */
function SidebarSection<T>({
  children,
  heading,
  noun,
  read,
}: {
  children: (rows: readonly T[]) => ReactNode;
  heading: string;
  noun: string;
  read: SectionRead<T>;
}) {
  const { rows, fault } = read;
  if (fault !== undefined) {
    return (
      <FoldSection heading={heading}>
        <ReadFailure fault={fault} noun={noun} />
      </FoldSection>
    );
  }
  if (rows === undefined || rows.length === 0) return null;
  return <FoldSection heading={heading}>{children(rows)}</FoldSection>;
}

/** On a touch screen, which has no hover, Peek always shows beside the count. */
const PEEK_ROOM = "pointer-coarse:pr-9";

/** Peek takes the count's box on the row's hover or focus, so nothing moves. */
const PEEK_SHOWN =
  "absolute top-0 right-0 opacity-0 group-hover/peek:opacity-100 group-focus-within/peek:opacity-100 pointer-coarse:opacity-100";
/** Under Peek the count fades, not hides, so it stays in the row's name. */
const COUNT_UNDER_PEEK =
  "not-pointer-coarse:group-hover/peek:opacity-0 not-pointer-coarse:group-focus-within/peek:opacity-0";

/** The sidebar's rows as `data` holds them; with `peek`, the Inbox row carries Peek. */
export function SidebarView({
  data,
  onNavigate,
  peek,
}: {
  data: SidebarData;
  onNavigate: (() => void) | undefined;
  peek: boolean;
}) {
  const peekable = useCommand("global.inbox-drawer")?.enabled === true && peek;
  return (
    <nav aria-label="Navigation" className="mt-2 flex flex-col gap-4">
      <ul className="flex flex-col gap-0.5">
        {data.destinations.map(({ name, label, icon: Icon, page, current, count }) => {
          const fault = retryableFaultOf(count);
          // A failed count's Retry takes the box Peek would show in.
          const peekHere = peekable && name === "inbox" && fault === undefined;
          const row = (
            <NavRow
              aria-current={current ? "page" : undefined}
              className={peekHere ? PEEK_ROOM : undefined}
              render={<PageLink onClick={onNavigate} page={page} />}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
              <RowCountMark
                className={cn("ml-auto", peekHere ? COUNT_UNDER_PEEK : null)}
                count={count}
              />
            </NavRow>
          );
          return (
            <li className={peekHere ? "group/peek relative" : fault && "relative"} key={name}>
              <HotkeyTooltip commandId={`global.${navCommandName(name)}`} side="right">
                {row}
              </HotkeyTooltip>
              {peekHere ? <PeekButton className={PEEK_SHOWN} tooltipSide="right" /> : null}
              {fault === undefined ? null : (
                <CountRetry
                  className="absolute top-0 right-0"
                  fault={fault}
                  noun={`the ${label} count`}
                />
              )}
            </li>
          );
        })}
      </ul>
      <SidebarSection heading="Pinned agents" noun="pinned agents" read={data.pinnedAgents}>
        {(agents) => (
          <ul className="flex flex-col gap-0.5">
            {agents.map((agent) => (
              <PinnedAgentRow
                agent={agent}
                key={agent.sessionId}
                onNavigate={onNavigate}
                replace={data.inLiveView}
              />
            ))}
          </ul>
        )}
      </SidebarSection>
      <SidebarSection heading="Pinned" noun="pinned issues" read={data.pinnedIssues}>
        {(items) => <ItemRows items={items} onNavigate={onNavigate} page={issue.routes.issue} />}
      </SidebarSection>
      <SidebarSection heading="Projects" noun="projects" read={data.projects}>
        {(items) => (
          <ItemRows items={items} onNavigate={onNavigate} page={project.routes.overview} />
        )}
      </SidebarSection>
    </nav>
  );
}

/** The sidebar: the nav table's destinations with their counts, then the pins. */
export function Sidebar({
  onNavigate,
  peek = false,
  user,
}: {
  onNavigate?: () => void;
  /** Draws Peek on the Inbox row; the narrow screen's header has its own. */
  peek?: boolean;
  user: AuthenticatedUser;
}) {
  return <SidebarView data={useSidebarData(user)} onNavigate={onNavigate} peek={peek} />;
}
