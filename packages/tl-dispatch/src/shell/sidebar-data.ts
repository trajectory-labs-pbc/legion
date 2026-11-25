import { useQuery } from "@tanstack/react-query";
import { api } from "@upstream-dispatch/api/client";
import {
  prioritySummaryQuery,
  projectsQuery,
  userAgentStateQuery,
} from "@upstream-dispatch/api/queries";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { useLiveViewState } from "@upstream-dispatch/features/agent-view/live-views";
import { useAgentPinWrite, usePinnedAgents } from "@upstream-dispatch/features/agents/pins";
import { totalUnreadReplies, unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { useInboxCount } from "@upstream-dispatch/features/inbox/useInboxCount";
import { useAgentText } from "@upstream-dispatch/features/refs/AgentName";

import { NAV_DESTINATIONS, type NavName } from "@/commands/nav";
import type { CommandIcon } from "@/commands/schema";
import { useAddress } from "@/navigation/hooks";
import type { PageRoute } from "@/navigation/page-route";
import { pathUnder } from "@/navigation/path";
import { useCurrentPage } from "@/pages/index";
import type { PageLayout } from "@/pages/page";
import { NAV_PAGES } from "./nav-pages";

/** A count beside a row, with what it counts; none at zero. */
interface SidebarCount {
  count: number | undefined;
  label?: string;
  /** What it counts waits on the reader, so it takes the "needs you" mark. */
  needsYou?: boolean;
}

interface SidebarDestination {
  name: NavName;
  label: string;
  icon: CommandIcon;
  page: PageRoute<string, string>;
  current: boolean;
  count: SidebarCount | undefined;
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
  pinnedAgents: readonly SidebarAgent[];
  /** A live view is open: a pinned agent's link replaces it rather than stacking on it. */
  inLiveView: boolean;
  pinnedIssues: readonly SidebarItem[] | undefined;
  projects: readonly SidebarItem[] | undefined;
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
  const inboxCount = useInboxCount();
  const agentState = useQuery(userAgentStateQuery()).data;
  const summary = useQuery(prioritySummaryQuery()).data;
  const pinnedIssues = useQuery({
    queryKey: ["issues", "pinned"],
    queryFn: () => api.listIssues({ pinned: true }),
  }).data;
  const projects = useQuery(projectsQuery()).data;
  const pinnedAgents = usePinnedAgents();
  // A deployment with no priority yet draws no count; nothing is off a list that does not exist.
  const priorityFaults =
    summary === undefined || (summary.empty ?? "") !== ""
      ? undefined
      : summary.work_under_no_priority.count + summary.priority_work_parked.count;
  const unread = totalUnreadReplies(agentState);
  const counts: Partial<Record<NavName, SidebarCount>> = {
    inbox: { count: inboxCount, needsYou: true },
    agents: { count: unread, label: unreadRepliesLabel(unread), needsYou: true },
    priorities: { count: priorityFaults },
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
    pinnedAgents: pinnedAgents.map((sessionId) => ({
      sessionId,
      selected: sessionId === open.liveView,
      unread: agentState?.[sessionId]?.unread_replies ?? 0,
    })),
    inLiveView: open.liveView !== undefined,
    pinnedIssues: pinnedIssues?.map((pinned) => ({
      key: pinned.key,
      text: pinned.title,
      openAsks: pinned.open_asks,
      current: pinned.key === open.issue,
    })),
    projects: projects?.map((shown) => ({
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
