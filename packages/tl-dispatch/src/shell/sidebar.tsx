import { Badge } from "@legion/ui/components/badge";
import { Heading } from "@legion/ui/components/heading";
import { KbdSequence } from "@legion/ui/components/kbd";
import { NavRow } from "@legion/ui/components/nav";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { PinButton } from "@upstream-dispatch/components/PinButton";
import { unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { AgentName } from "@upstream-dispatch/features/refs/AgentName";
import type { ReactNode } from "react";
import { type NavName, navCommandName } from "@/commands/nav";
import { useCommandShortcut } from "@/commands/use-command";
import { PageLink } from "@/navigation/page-link";
import { issue } from "@/pages/issue";
import { project } from "@/pages/project";
import {
  type SidebarAgent,
  type SidebarData,
  type SidebarItem,
  usePinnedAgent,
  useSidebarData,
} from "./sidebar-data";

/** A count beside a row; none while there is nothing to count. */
function Count({ count, label }: { count: number | undefined; label?: string }) {
  if (count === undefined || count === 0) return null;
  return <Badge title={label}>{count}</Badge>;
}

/** The destination's `G` chord, while it runs. */
function KeyHint({ name }: { name: NavName }) {
  const chips = useCommandShortcut(`global.${navCommandName(name)}` as const);
  return chips === null ? null : <KbdSequence chips={chips} className="ml-auto" />;
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Heading className="px-2 pb-1" size="label" tone="muted">
      {children}
    </Heading>
  );
}

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
  return (
    <NavRow aria-current={agent.selected ? "page" : undefined} render={<li />}>
      <AgentName
        className="min-w-0 flex-1"
        onNavigate={onNavigate}
        replace={replace}
        sessionId={agent.sessionId}
        storedTitle={undefined}
      />
      <Count count={agent.unread} label={unreadRepliesLabel(agent.unread)} />
      <span className="shrink-0 text-xs text-muted-foreground">{viewState}</span>
      <PinButton label={`Unpin ${name} from the sidebar`} onClick={unpin} pinned quiet />
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
            <Count count={item.openAsks} />
          </NavRow>
        </li>
      ))}
    </ul>
  );
}

/** The sidebar's rows as `data` holds them. */
function SidebarView({
  data,
  onNavigate,
}: {
  data: SidebarData;
  onNavigate: (() => void) | undefined;
}) {
  return (
    <nav aria-label="Navigation" className="mt-6 flex flex-col gap-5">
      <ul className="flex flex-col gap-0.5">
        {data.destinations.map(({ name, label, icon: Icon, page, current, count }) => (
          <li key={name}>
            <NavRow
              aria-current={current ? "page" : undefined}
              render={<PageLink onClick={onNavigate} page={page} />}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
              <Count count={count?.count} label={count?.label} />
              <KeyHint name={name} />
            </NavRow>
          </li>
        ))}
      </ul>
      {data.pinnedAgents.length === 0 ? null : (
        <section>
          <SectionHeading>Pinned agents</SectionHeading>
          <ul className="flex flex-col gap-0.5">
            {data.pinnedAgents.map((agent) => (
              <PinnedAgentRow
                agent={agent}
                key={agent.sessionId}
                onNavigate={onNavigate}
                replace={data.inLiveView}
              />
            ))}
          </ul>
        </section>
      )}
      {data.pinnedIssues === undefined || data.pinnedIssues.length === 0 ? null : (
        <section>
          <SectionHeading>Pinned</SectionHeading>
          <ItemRows items={data.pinnedIssues} onNavigate={onNavigate} page={issue.routes.issue} />
        </section>
      )}
      {data.projects === undefined ? null : (
        <section>
          <SectionHeading>Projects</SectionHeading>
          <ItemRows items={data.projects} onNavigate={onNavigate} page={project.routes.overview} />
        </section>
      )}
    </nav>
  );
}

/** The sidebar: the nav table's destinations with their counts and keys, then the pins. */
export function Sidebar({
  onNavigate,
  user,
}: {
  onNavigate?: () => void;
  user: AuthenticatedUser;
}) {
  return <SidebarView data={useSidebarData(user)} onNavigate={onNavigate} />;
}
