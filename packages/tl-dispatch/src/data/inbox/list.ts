import type { InboxRow, MyReplyRow } from "@/upstream/contract";
import {
  DEFAULT_FOLDED_GROUPS,
  type GroupingContext,
  group,
  INBOX_FILTER_FIELDS,
  type InboxGroup,
  type InboxGroupBy,
  type InboxListRow,
  type InboxRoute,
  inAssigneeFilter,
  inFieldFilter,
  isOwnList,
  LATER_GROUP_KEY,
  matchesInboxSearch,
  sectionOf,
  sectionTitles,
  sortRows,
} from "@/upstream/logic/inbox";
import type { Read } from "../read";
import { isPerson, useSession } from "../session";
import { searchWordsOf } from "./empty-list";
import { useInboxAsks, useInboxThreads } from "./reads";

export type { InboxGroup } from "@/upstream/logic/inbox";

/** How the new Inbox groups its list: one of upstream's groupings, or "Needs you" (R3). */
export type InboxGrouping = InboxGroupBy | "needs-you";

/** The fields of the Inbox's address that decide which rows the list holds, and how. */
export type InboxListAddress = Omit<InboxRoute, "group"> & { group: InboxGrouping };

/** The key of the "Needs you" group, which its fold is kept under. */
export const NEEDS_YOU_GROUP_KEY = "needs-you";

/** The list as the view draws it: its groups, and whether it is the reader's own. */
export interface InboxList {
  groups: readonly InboxGroup[];
  own: boolean;
}

/** Whether a group starts folded: Later, until the reader opens it. */
export const foldedAtFirst = (key: string) => DEFAULT_FOLDED_GROUPS.includes(key);

/** Whether a group's rows are all of one urgency, which its header then shows (LR7). */
export const groupShowsUrgency = (grouping: InboxGrouping, key: string) =>
  key !== LATER_GROUP_KEY &&
  (grouping === "urgency" || (grouping === "needs-you" && key !== NEEDS_YOU_GROUP_KEY));

// An agent filter and `?section=needs-you` narrow the list to asks, as upstream's do.
const asksOnly = ({ agent, section }: InboxListAddress) =>
  agent !== undefined || section === "needs-you";

/**
 * "Needs you" first: the rows of upstream's first band (`human`), so each thread and each ask
 * whose turn is a person's and that is not snoozed. Then each other ask by its urgency, and the
 * snoozed asks last, in Later (INB-56, INB-57, INB-59).
 */
function needsYouGroups(rows: readonly InboxListRow[], context: GroupingContext): InboxGroup[] {
  const bands = group(rows, "waiting-on", context);
  const first = bands.find((band) => band.key === "human");
  const later = bands.find((band) => band.key === LATER_GROUP_KEY);
  const elsewhere = new Set([...(first?.rows ?? []), ...(later?.rows ?? [])]);
  return [
    ...(first === undefined
      ? []
      : [{ key: NEEDS_YOU_GROUP_KEY, label: context.titles.human, rows: first.rows }]),
    ...group(
      rows.filter((row) => !elsewhere.has(row)),
      "urgency",
      context
    ),
    ...(later === undefined ? [] : [later]),
  ];
}

/**
 * The list for its address, as upstream's Inbox narrows and sorts it: the agent, the turn, who it
 * is for, the search text and the four fields. Then the address's grouping.
 */
export function inboxList({
  asks,
  threads,
  address,
  viewer,
  now,
}: {
  asks: readonly InboxRow[];
  threads: readonly MyReplyRow[];
  address: InboxListAddress;
  /** The signed-in person's login. */
  viewer: string;
  now: number;
}): InboxList {
  const { agent, section } = address;
  const askRows: InboxListRow[] = asks
    .filter(
      (ask) => agent === undefined || (ask.author.kind === "session" && ask.author.id === agent)
    )
    .map((ask) => ({ kind: "ask" as const, ask }))
    .filter((row) => section !== "needs-you" || sectionOf(row, now) === "human");
  const threadRows: InboxListRow[] = asksOnly(address)
    ? []
    : threads.map((thread) => ({ kind: "thread", thread }));
  const selection = address.assignees ?? [viewer];
  const words = searchWordsOf(address.q);
  const narrowed = [...askRows, ...threadRows].filter(
    (row) =>
      inAssigneeFilter(row, selection, viewer) &&
      matchesInboxSearch(row, words) &&
      INBOX_FILTER_FIELDS.every((field) =>
        inFieldFilter(row, field, address.filters?.[field], viewer)
      )
  );
  const sorted = sortRows(narrowed, address.sort ?? "newest", viewer);
  const context = { now, titles: sectionTitles(selection, viewer), viewer };
  return {
    groups:
      address.group === "needs-you"
        ? needsYouGroups(sorted, context)
        : group(sorted, address.group, context),
    own: isOwnList(selection, viewer),
  };
}

/**
 * The Inbox's list for its address: the asks, and the reader's threads where the list holds
 * them. The Dismissed view, which is paged, comes with the list's paging.
 */
export function useInboxList(address: InboxListAddress): Read<InboxList> {
  const session = useSession();
  const asks = useInboxAsks();
  const threadsShown = isPerson(session) && address.show !== "dismissed" && !asksOnly(address);
  const threads = useInboxThreads({ enabled: threadsShown });
  const reads = threadsShown ? [session, asks, threads] : [session, asks];
  const failed = reads.find((read) => read.state === "error");
  if (failed?.state === "error") return failed;
  if (session.state !== "ready" || asks.state !== "ready") return { state: "loading" };
  if (threadsShown && threads.state !== "ready") return { state: "loading" };
  const list = inboxList({
    asks: asks.data,
    threads: threadsShown && threads.state === "ready" ? (threads.data.rows ?? []) : [],
    address,
    viewer: session.data.login,
    now: Date.now(),
  });
  return {
    state: "ready",
    data: list,
    refreshError: reads
      .map((read) => (read.state === "ready" ? read.refreshError : undefined))
      .find((error) => error !== undefined),
  };
}
