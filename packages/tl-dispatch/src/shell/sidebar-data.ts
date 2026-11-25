import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { api } from "@upstream-dispatch/api/client";
import {
  prioritySummaryQuery,
  projectsQuery,
  userAgentStateQuery,
} from "@upstream-dispatch/api/queries";
import type { AuthenticatedUser, UserAgentStates } from "@upstream-dispatch/api/types";
import { useLiveViewState } from "@upstream-dispatch/features/agent-view/live-views";
import { pinnedAgentSessions, useAgentPinWrite } from "@upstream-dispatch/features/agents/pins";
import { totalUnreadReplies } from "@upstream-dispatch/features/agents/unread";
import { useAgentText } from "@upstream-dispatch/features/refs/AgentName";

import { NAV_DESTINATIONS, type NavName } from "@/commands/nav";
import type { CommandIcon } from "@/commands/schema";
import { useAddress } from "@/navigation/hooks";
import type { PageRoute } from "@/navigation/page-route";
import { pathUnder } from "@/navigation/path";
import { useCurrentPage } from "@/pages/index";
import type { PageLayout } from "@/pages/page";
import { useInboxRowCount } from "./inbox-count";
import { NAV_PAGES } from "./nav-pages";
import { retryOf } from "./read-line";
import type { RowCount } from "./row-count";

interface SidebarDestination {
  name: NavName;
  label: string;
  icon: CommandIcon;
  page: PageRoute<string, string>;
  current: boolean;
  /** A `G` chord opens it, which its row's tooltip shows. */
  keyed: boolean;
  count: RowCount | undefined;
}

/** A section's rows, none while its read is out; `failed` stays set while a Retry runs. */
export interface SectionRead<T> {
  rows: readonly T[] | undefined;
  failed: boolean;
  retry: (() => void) | undefined;
}

function sectionOf<T, R>(query: UseQueryResult<readonly T[]>, row: (item: T) => R): SectionRead<R> {
  return { rows: query.data?.map(row), failed: query.isLoadingError, retry: retryOf(query) };
}

/** The pinned agents, oldest pin first, with their unread replies. */
function pinnedOf(states: UserAgentStates): readonly { sessionId: string; unread: number }[] {
  return pinnedAgentSessions(states).map((sessionId) => ({
    sessionId,
    unread: states[sessionId]?.unread_replies ?? 0,
  }));
}

export interface SidebarItem {
  key: string;
  /** The issue's title or the project's name. */
  text: string;
  openAsks: number;
  current: boolean;
}

export interface SidebarAgent {
  sessionId: string;
  selected: boolean;
  unread: number;
}

export interface SidebarData {
  destinations: readonly SidebarDestination[];
  pinnedAgents: SectionRead<SidebarAgent>;
  /** A live view is open: a pinned agent's link replaces it rather than stacking on it. */
  inLiveView: boolean;
  pinnedIssues: SectionRead<SidebarItem>;
  projects: SectionRead<SidebarItem>;
}

/** What the page shows that a sidebar row can name: a live view, an issue, a project's own page. */
export function openOf(layout: PageLayout): {
  liveView: string | undefined;
  issue: string | undefined;
  project: string | undefined;
} {
  // An issue's page belongs to its project, but the project's row stays unlit there.
  return {
    liveView: layout.liveView,
    issue: layout.issue,
    project: layout.issue === undefined ? layout.project : undefined,
  };
}

/** The sidebar's rows: the destinations with their counts, the pinned agents and issues, the projects. */
export function useSidebarData(user: Pick<AuthenticatedUser, "kind">): SidebarData {
  const { pathname } = useAddress();
  const open = openOf(useCurrentPage()?.layout ?? {});
  const inboxCount = useInboxRowCount();
  const agents = useQuery(userAgentStateQuery());
  // Sorted in its own selection, which runs only when the agent state changes.
  const pinnedAgents = useQuery({ ...userAgentStateQuery(), select: pinnedOf });
  const summaryRead = useQuery(prioritySummaryQuery());
  const summary = summaryRead.data;
  const pinnedIssues = useQuery({
    queryKey: ["issues", "pinned"],
    queryFn: () => api.listIssues({ pinned: true }),
  });
  const projects = useQuery(projectsQuery());
  // A deployment with no priority yet draws no count; nothing is off a list that does not exist.
  const priorityFaults =
    summary === undefined || (summary.empty ?? "") !== ""
      ? undefined
      : summary.work_under_no_priority.count + summary.priority_work_parked.count;
  const counts: Partial<Record<NavName, RowCount>> = {
    inbox: inboxCount,
    agents: { count: totalUnreadReplies(agents.data), retry: retryOf(agents) },
    priorities: { count: priorityFaults, retry: retryOf(summaryRead) },
  };
  return {
    destinations: NAV_DESTINATIONS.filter(
      ({ name }) => name !== "settings" || user.kind === "user"
    ).map((destination) => ({
      name: destination.name,
      label: destination.label,
      icon: destination.icon,
      page: NAV_PAGES[destination.name],
      current: pathUnder(NAV_PAGES[destination.name].path, pathname),
      keyed: "key" in destination,
      count: counts[destination.name],
    })),
    pinnedAgents: sectionOf(pinnedAgents, (agent) => ({
      ...agent,
      selected: agent.sessionId === open.liveView,
    })),
    inLiveView: open.liveView !== undefined,
    pinnedIssues: sectionOf(pinnedIssues, (pinned) => ({
      key: pinned.key,
      text: pinned.title,
      openAsks: pinned.open_asks,
      current: pinned.key === open.issue,
    })),
    projects: sectionOf(projects, (shown) => ({
      key: shown.key,
      text: shown.name,
      openAsks: shown.open_asks,
      current: shown.key === open.project,
    })),
  };
}

/** A pinned agent's name, its live view's state, and the way to unpin it. */
export function usePinnedAgent(sessionId: string): {
  name: string;
  viewState: ReturnType<typeof useLiveViewState>;
  unpin: () => void;
} {
  const name = useAgentText().sessionText(sessionId, undefined);
  const viewState = useLiveViewState(sessionId);
  const writePin = useAgentPinWrite();
  return { name, viewState, unpin: () => writePin(sessionId, false) };
}
