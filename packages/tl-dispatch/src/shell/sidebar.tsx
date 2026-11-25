import { Button } from "@legion/ui/components/button";
import { Count } from "@legion/ui/components/count";
import { NavRow } from "@legion/ui/components/nav";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { AgentName } from "@upstream-dispatch/features/refs/AgentName";
import { PinIcon } from "lucide-react";
import type { ReactNode } from "react";
import { HotkeyTooltip } from "@/commands/hotkey-tooltip";
import { navCommandName } from "@/commands/nav";
import { useCommand } from "@/commands/use-command";
import { PageLink } from "@/navigation/page-link";
import { issue } from "@/pages/issue";
import { project } from "@/pages/project";
import { FoldSection } from "./fold-section";
import { PeekButton } from "./peek-button";
import { ReadLine } from "./read-line";
import { RowCountMark } from "./row-count";

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
    <NavRow aria-current={agent.selected ? "page" : undefined} render={<li />}>
      <AgentName
        className="min-w-0 flex-1"
        onNavigate={onNavigate}
        replace={replace}
        sessionId={agent.sessionId}
        storedTitle={undefined}
      />
      <Count title={unreadRepliesLabel(agent.unread)} value={agent.unread} />
      <span className="shrink-0 text-xs text-muted-foreground">{viewState}</span>
      <Button
        aria-label={unpinLabel}
        aria-pressed
        onClick={unpin}
        size="icon-xs"
        title={unpinLabel}
        variant="ghost"
      >
        <PinIcon aria-hidden className="fill-current" />
      </Button>
    </NavRow>
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
            <span className="shrink-0 font-medium">{item.key}</span>
            <span className="truncate text-muted-foreground">{item.text}</span>
            <Count className="ml-auto" value={item.openAsks} />
          </NavRow>
        </li>
      ))}
    </ul>
  );
}

/**
 * A folded section of rows, or its read's line. With `optional`, nothing while the read is out or
 * has no rows, so the section never shows and then leaves; a failed read still says so.
 */
function SidebarSection<T>({
  children,
  heading,
  noun,
  optional = false,
  read,
}: {
  children: (rows: readonly T[]) => ReactNode;
  heading: string;
  noun: string;
  optional?: boolean;
  read: SectionRead<T>;
}) {
  const { rows, retry } = read;
  if (optional && retry === undefined && (rows?.length ?? 0) === 0) return null;
  return (
    <FoldSection heading={heading}>
      {rows === undefined ? <ReadLine noun={noun} retry={retry} /> : children(rows)}
    </FoldSection>
  );
}

/** Room at the Inbox row's edge for Peek, while Peek shows. */
const PEEK_ROOM = "group-hover/peek:pr-9 group-focus-within/peek:pr-9 pointer-coarse:pr-9";

/** Peek shows on the row's hover or focus, and always on a touch screen, which has no hover. */
const PEEK_SHOWN =
  "absolute top-0 right-0 opacity-0 group-hover/peek:opacity-100 group-focus-within/peek:opacity-100 pointer-coarse:opacity-100";

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
        {data.destinations.map(({ name, label, icon: Icon, page, current, keyed, count }) => {
          const peekHere = peekable && name === "inbox";
          const row = (
            <NavRow
              aria-current={current ? "page" : undefined}
              className={peekHere ? PEEK_ROOM : undefined}
              render={<PageLink onClick={onNavigate} page={page} />}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
              <RowCountMark className="ml-auto" count={count} />
            </NavRow>
          );
          return (
            <li className={peekHere ? "group/peek relative" : undefined} key={name}>
              {keyed ? (
                <HotkeyTooltip commandId={`global.${navCommandName(name)}`} side="right">
                  {row}
                </HotkeyTooltip>
              ) : (
                row
              )}
              {peekHere ? <PeekButton className={PEEK_SHOWN} tooltipSide="right" /> : null}
              {count?.retry === undefined ? null : (
                <ReadLine noun={`the ${label} count`} retry={count.retry} />
              )}
            </li>
          );
        })}
      </ul>
      <SidebarSection heading="Pinned agents" noun="pinned agents" read={data.pinnedAgents}>
        {(agents) =>
          agents.length === 0 ? (
            <p className="px-2 text-xs text-pretty text-muted-foreground">
              Pin an agent on the Agents page, or in its live view, to keep it here.
            </p>
          ) : (
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
          )
        }
      </SidebarSection>
      <SidebarSection heading="Pinned" noun="pinned issues" optional read={data.pinnedIssues}>
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
