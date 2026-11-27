import { NAV_DESTINATIONS, type NavName } from "@/commands/nav";
import type { CommandIcon } from "@/commands/schema";
import { totalUnreadReplies, unreadRepliesLabel } from "@/data/agent-pins";
import type { RetryableFault } from "@/data/read";
import type { AuthenticatedUser } from "@/data/session";
import type { ShellRead } from "@/data/shell-read";
import {
  useAgentStates,
  usePinnedAgentRows,
  usePinnedIssues,
  usePrioritySummary,
  useProjects,
} from "@/data/sidebar";
import { useAddress } from "@/navigation/hooks";
import type { PageRoute } from "@/navigation/page-route";
import { pathUnder } from "@/navigation/path";
import { useInboxRowCount } from "./inbox-count";
import { NAV_PAGES } from "./nav-pages";
import { type PageLayout, useCurrentRoute } from "./page-layout";
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

function sectionOf<T, R>(read: ShellRead<readonly T[]>, row: (item: T) => R): SectionRead<R> {
  return { rows: read.data?.map(row), fault: read.fault };
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
  const agents = useAgentStates();
  const unread = totalUnreadReplies(agents.data);
  return { count: unread, label: unreadRepliesLabel(unread), fault: agents.fault };
}

/** The Priorities row's count: the work off a priority. */
function usePrioritiesRowCount(): RowCount {
  const summary = usePrioritySummary();
  return { count: priorityFaults(summary.data), fault: summary.fault };
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
  const open = openOf(useCurrentRoute()?.layout ?? {});
  const counts: Partial<Record<NavName, RowCount>> = {
    inbox: useInboxRowCount(),
    agents: useAgentsRowCount(),
    priorities: usePrioritiesRowCount(),
  };
  const pinnedAgents = usePinnedAgentRows();
  const pinnedIssues = usePinnedIssues();
  const projects = useProjects();
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
      rows: pinnedAgents?.map((agent) => ({
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
