import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { NAV_DESTINATIONS, type NavName } from "@/commands/nav";
import type { CommandIcon } from "@/commands/schema";
import type { RetryableFault } from "@/data/read";
import { readFailureOf } from "@/features/read-failure";
import { useAddress } from "@/navigation/hooks";
import type { PageRoute } from "@/navigation/page-route";
import { pathUnder } from "@/navigation/path";
import { useCurrentPage } from "@/pages/index";
import type { PageLayout } from "@/pages/page";
import { api } from "@/upstream/api";
import type { AuthenticatedUser, UserAgentStates } from "@/upstream/contract";
import {
  pinnedAgentSessions,
  totalUnreadReplies,
  unreadRepliesLabel,
  useAgentPinWrite,
  useAgentText,
  useLiveViewState,
} from "@/upstream/data-hooks";
import { prioritySummaryQuery, projectsQuery, userAgentStateQuery } from "@/upstream/queries";
import { useInboxRowCount } from "./inbox-count";
import { NAV_PAGES } from "./nav-pages";
import type { RowCount } from "./row-count";

interface SidebarDestination {
  name: NavName;
  label: string;
  icon: CommandIcon;
  page: PageRoute<string, string>;
  current: boolean;
  count: RowCount | undefined;
}

/** A section's rows, none while its read is out or after it failed. */
export interface SectionRead<T> {
  rows: readonly T[] | undefined;
  fault: RetryableFault | undefined;
}

function sectionOf<T, R>(query: UseQueryResult<readonly T[]>, row: (item: T) => R): SectionRead<R> {
  return { rows: query.data?.map(row), fault: readFailureOf(query) };
}

/** Work under no priority or parked under one; none until the summary names a priority. */
export function priorityFaults(
  summary:
    | {
        empty?: string | null;
        work_under_no_priority: { count: number };
        priority_work_parked: { count: number };
      }
    | undefined
): number | undefined {
  if (summary === undefined || (summary.empty ?? "") !== "") return undefined;
  return summary.work_under_no_priority.count + summary.priority_work_parked.count;
}

/** The Agents row's count: the unread replies of every agent. */
export function useAgentsRowCount(): RowCount {
  const agents = useQuery(userAgentStateQuery());
  const unread = totalUnreadReplies(agents.data);
  return { count: unread, label: unreadRepliesLabel(unread), fault: readFailureOf(agents) };
}

/** The Priorities row's count: the work off a priority. */
function usePrioritiesRowCount(): RowCount {
  const summary = useQuery(prioritySummaryQuery());
  return { count: priorityFaults(summary.data), fault: readFailureOf(summary) };
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
  const counts: Partial<Record<NavName, RowCount>> = {
    inbox: useInboxRowCount(),
    agents: useAgentsRowCount(),
    priorities: usePrioritiesRowCount(),
  };
  // Sorted in its own selection, which runs only when the agent state changes.
  const pinnedAgents = useQuery({ ...userAgentStateQuery(), select: pinnedOf });
  const pinnedIssues = useQuery({
    queryKey: ["issues", "pinned"],
    queryFn: () => api.listIssues({ pinned: true }),
  });
  const projects = useQuery(projectsQuery());
  return {
    destinations: NAV_DESTINATIONS.filter(
      ({ name }) => name !== "settings" || user.kind === "user"
    ).map(({ name, label, icon }) => {
      const page = NAV_PAGES[name];
      return {
        name,
        label,
        icon,
        page,
        current: pathUnder(page.path, pathname),
        count: counts[name],
      };
    }),
    pinnedAgents: {
      rows: pinnedAgents.data?.map((agent) => ({
        ...agent,
        selected: agent.sessionId === open.liveView,
      })),
      // The Agents row reads the same state, and its count's Retry is the one that reports it.
      fault: undefined,
    },
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
