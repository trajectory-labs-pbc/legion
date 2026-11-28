import { useQuery } from "@tanstack/react-query";
import { api } from "@/upstream/api";
import type { UserAgentStates } from "@/upstream/contract";
import { pinnedAgentSessions } from "@/upstream/data-hooks";
import { prioritySummaryQuery, projectsQuery, userAgentStateQuery } from "@/upstream/queries";
import { type ShellRead, useShellRead } from "./shell-read";

/** Each agent's state for the reader. */
export function useAgentStates(): ShellRead<UserAgentStates> {
  return useShellRead(useQuery(userAgentStateQuery()));
}

/** The pinned agents, oldest pin first, with their unread replies. */
function pinnedOf(states: UserAgentStates): readonly { sessionId: string; unread: number }[] {
  return pinnedAgentSessions(states).map((sessionId) => ({
    sessionId,
    unread: states[sessionId]?.unread_replies ?? 0,
  }));
}

/** The pinned agents; the Agents row's count reports a failure of the same read. */
export function usePinnedAgentRows(): readonly { sessionId: string; unread: number }[] | undefined {
  // Sorted in its own selection, which runs only when the agent state changes.
  return useQuery({ ...userAgentStateQuery(), select: pinnedOf }).data;
}

/** The summary of the reader's priorities. */
export function usePrioritySummary() {
  return useShellRead(useQuery(prioritySummaryQuery()));
}

/** The issues the reader pinned. */
export function usePinnedIssues() {
  return useShellRead(
    useQuery({ queryKey: ["issues", "pinned"], queryFn: () => api.listIssues({ pinned: true }) })
  );
}

/** The projects the reader sees. */
export function useProjects() {
  return useShellRead(useQuery(projectsQuery()));
}
