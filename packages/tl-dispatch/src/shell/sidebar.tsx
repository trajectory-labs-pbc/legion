import { useQuery } from "@tanstack/react-query";
import { api } from "@upstream-dispatch/api/client";
import {
  prioritySummaryQuery,
  projectsQuery,
  userAgentStateQuery,
} from "@upstream-dispatch/api/queries";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { PinButton } from "@upstream-dispatch/components/PinButton";
import { useLiveViewState } from "@upstream-dispatch/features/agent-view/live-views";
import { useAgentPinWrite, usePinnedAgents } from "@upstream-dispatch/features/agents/pins";
import { totalUnreadReplies, unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { useInboxCount } from "@upstream-dispatch/features/inbox/useInboxCount";
import { AgentName, useAgentText } from "@upstream-dispatch/features/refs/AgentName";
import {
  liveViewSessionOf,
  parseIssuePath,
  parseProjectPath,
} from "@upstream-dispatch/features/refs/routes";
import type { ReactNode } from "react";

import { useCommandShortcut } from "@/commands/hooks";
import { NAV_DESTINATIONS, type NavName, navCommandName } from "@/commands/nav";
import { useAddress } from "@/navigation/hooks";
import { PageLink } from "@/navigation/page-link";
import { pathUnder } from "@/navigation/path";
import { issue } from "@/pages/issue";
import { project } from "@/pages/project";
import { Heading } from "@/ui/heading";
import { KbdSequence } from "@/ui/kbd";
import { NAV_PAGES } from "./nav-pages";

const ROW =
  "flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground";

const BADGE =
  "shrink-0 rounded-full bg-sidebar-primary px-1.5 text-xs text-sidebar-primary-foreground";

function Badge({ count, label }: { count: number | undefined; label?: string }) {
  if (count === undefined || count === 0) return null;
  return (
    <span className={BADGE} title={label}>
      {count}
    </span>
  );
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
  onNavigate,
  replace,
  selected,
  sessionId,
  unread,
}: {
  onNavigate: (() => void) | undefined;
  replace: boolean;
  selected: boolean;
  sessionId: string;
  unread: number;
}) {
  const name = useAgentText().sessionText(sessionId, undefined);
  const viewState = useLiveViewState(sessionId);
  const writePin = useAgentPinWrite();
  return (
    <li
      aria-current={selected ? "page" : undefined}
      className="flex h-8 items-center gap-2 rounded-md px-2 text-sm aria-[current=page]:bg-sidebar-accent"
    >
      <AgentName
        className="min-w-0 flex-1"
        onNavigate={onNavigate}
        replace={replace}
        sessionId={sessionId}
        storedTitle={undefined}
      />
      <Badge count={unread} label={unreadRepliesLabel(unread)} />
      <span className="shrink-0 text-xs text-muted-foreground">{viewState}</span>
      <PinButton
        label={`Unpin ${name} from the sidebar`}
        onClick={() => writePin(sessionId, false)}
        pinned
        quiet
      />
    </li>
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
  const { pathname } = useAddress();
  const inboxCount = useInboxCount();
  const agentState = useQuery(userAgentStateQuery()).data;
  const summary = useQuery(prioritySummaryQuery()).data;
  const pinnedIssues = useQuery({
    queryKey: ["issues", "pinned"],
    queryFn: () => api.listIssues({ pinned: true }),
  }).data;
  const projects = useQuery(projectsQuery()).data;
  const pinnedAgents = usePinnedAgents();
  const liveView = liveViewSessionOf(pathname);
  const openIssue = parseIssuePath(pathname)?.key;
  const openProject = parseProjectPath(pathname)?.project;
  // A deployment with no priority yet draws no count; nothing is off a list that does not exist.
  const priorityFaults =
    summary === undefined || (summary.empty ?? "") !== ""
      ? undefined
      : summary.work_under_no_priority.count + summary.priority_work_parked.count;
  const unread = totalUnreadReplies(agentState);
  const counts: Partial<Record<NavName, { count: number | undefined; label?: string }>> = {
    inbox: { count: inboxCount },
    agents: { count: unread, label: unreadRepliesLabel(unread) },
    priorities: { count: priorityFaults },
  };
  const destinations = NAV_DESTINATIONS.filter(
    ({ name }) => name !== "settings" || user.kind === "user"
  );
  return (
    <nav aria-label="Navigation" className="mt-6 flex flex-col gap-5">
      <ul className="flex flex-col gap-0.5">
        {destinations.map(({ name, label, icon: Icon }) => (
          <li key={name}>
            <PageLink
              aria-current={pathUnder(NAV_PAGES[name].path, pathname) ? "page" : undefined}
              className={ROW}
              onClick={onNavigate}
              page={NAV_PAGES[name]}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
              <Badge count={counts[name]?.count} label={counts[name]?.label} />
              <KeyHint name={name} />
            </PageLink>
          </li>
        ))}
      </ul>
      {pinnedAgents.length === 0 ? null : (
        <section>
          <SectionHeading>Pinned agents</SectionHeading>
          <ul className="flex flex-col gap-0.5">
            {pinnedAgents.map((sessionId) => (
              <PinnedAgentRow
                key={sessionId}
                onNavigate={onNavigate}
                replace={liveView !== undefined}
                selected={sessionId === liveView}
                sessionId={sessionId}
                unread={agentState?.[sessionId]?.unread_replies ?? 0}
              />
            ))}
          </ul>
        </section>
      )}
      {pinnedIssues === undefined || pinnedIssues.length === 0 ? null : (
        <section>
          <SectionHeading>Pinned</SectionHeading>
          <ul className="flex flex-col gap-0.5">
            {pinnedIssues.map((pinned) => (
              <li key={pinned.key}>
                <PageLink
                  aria-current={pinned.key === openIssue ? "page" : undefined}
                  className={ROW}
                  onClick={onNavigate}
                  page={issue.routes.issue}
                  params={{ key: pinned.key }}
                >
                  <span className="shrink-0 font-medium">{pinned.key}</span>
                  <span className="truncate text-muted-foreground">{pinned.title}</span>
                  <Badge count={pinned.open_asks} />
                </PageLink>
              </li>
            ))}
          </ul>
        </section>
      )}
      {projects === undefined ? null : (
        <section>
          <SectionHeading>Projects</SectionHeading>
          <ul className="flex flex-col gap-0.5">
            {projects.map((shown) => (
              <li key={shown.key}>
                <PageLink
                  aria-current={shown.key === openProject ? "page" : undefined}
                  className={ROW}
                  onClick={onNavigate}
                  page={project.routes.overview}
                  params={{ key: shown.key }}
                >
                  <span className="shrink-0 font-medium">{shown.key}</span>
                  <span className="truncate text-muted-foreground">{shown.name}</span>
                  <Badge count={shown.open_asks} />
                </PageLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </nav>
  );
}
