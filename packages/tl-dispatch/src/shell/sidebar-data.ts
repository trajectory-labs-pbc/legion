import { useQuery } from "@tanstack/react-query";
import { api } from "@upstream-dispatch/api/client";
import {
  prioritySummaryQuery,
  projectsQuery,
  userAgentStateQuery,
} from "@upstream-dispatch/api/queries";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
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

/** A count beside a row; none at zero. Its row's key tooltip names the row. */
interface SidebarCount {
  count: number | undefined;
  /** What it counts waits on the reader, so it takes the "needs you" mark. */
  needsYou?: boolean;
  /** Its read failed with nothing to show: asks again. */
  retry?: () => void;
}

interface SidebarDestination {
  name: NavName;
  label: string;
  icon: CommandIcon;
  page: PageRoute<string, string>;
  current: boolean;
  count: SidebarCount | undefined;
}

/** A section's read: still out, failed with a way to ask again, or its rows. */
export type SectionRead<T> =
  | { status: "pending" }
  | { status: "error"; retry: () => void }
  | { status: "success"; rows: readonly T[] };

interface Read<T> {
  data: T | undefined;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

/** Asks `query` again; undefined unless it failed with nothing to show and is not asking already. */
function retryOf<T>(query: Read<T>): (() => void) | undefined {
  return query.data === undefined && query.isError && !query.isFetching
    ? () => void query.refetch()
    : undefined;
}

function sectionOf<T, R>(query: Read<readonly T[]>, row: (item: T) => R): SectionRead<R> {
  if (query.data !== undefined) return { status: "success", rows: query.data.map(row) };
  const retry = retryOf(query);
  return retry === undefined ? { status: "pending" } : { status: "error", retry };
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
  const agentState = agents.data;
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
  const counts: Partial<Record<NavName, SidebarCount>> = {
    inbox: inboxCount,
    agents: { count: totalUnreadReplies(agentState), retry: retryOf(agents) },
    priorities: { count: priorityFaults, retry: retryOf(summaryRead) },
  };
  return {
    destinations: NAV_DESTINATIONS.filter(
      ({ name }) => name !== "settings" || user.kind === "user"
    ).map(({ name, label, icon }) => ({
      name,
      label,
      icon,
      page: NAV_PAGES[name],
      current: pathUnder(NAV_PAGES[name].path, pathname),
      count: counts[name],
    })),
    pinnedAgents: sectionOf(
      {
        data: agentState === undefined ? undefined : pinnedAgentSessions(agentState),
        isError: agents.isError,
        isFetching: agents.isFetching,
        refetch: agents.refetch,
      },
      (sessionId) => ({
        sessionId,
        selected: sessionId === open.liveView,
        unread: agentState?.[sessionId]?.unread_replies ?? 0,
      })
    ),
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
