import { isOwnList, searchWordsOf } from "@/data/inbox/empty-list";

/** The fields of the Inbox's address that decide what an empty list says; upstream's route has each. */
export interface EmptyListAddress {
  readonly q?: string;
  readonly show?: "dismissed";
  readonly agent?: string;
  /** Absent is the reader's own list, empty is everyone, and a value names a person or `unassigned`. */
  readonly assignees?: readonly string[];
  readonly filters?: Readonly<Partial<Record<string, readonly string[]>>>;
}

/** What an empty list shows: upstream's title, one sentence, and whether Clear filters is its action. */
export interface EmptyList {
  readonly title: string;
  readonly sentence: string;
  readonly clearsFilters: boolean;
}

/**
 * What the list says when it has no row, as the spec's table "Empty lists" gives it; nothing while
 * the credential requests hold it. The first case that applies wins: the search text, the
 * Dismissed view, the agent, a filter or another selection of people, the reader's own list, and
 * everyone (INB-30 to INB-34).
 */
export function emptyList({
  address,
  viewer,
  agentName,
  credentialsHold,
}: {
  address: EmptyListAddress;
  /** The signed-in person's email. */
  viewer: string | undefined;
  /** The agent of `?agent=`, in plain text. */
  agentName: string | undefined;
  credentialsHold: boolean;
}): EmptyList | undefined {
  const selection = address.assignees ?? (viewer === undefined ? [] : [viewer]);
  const own = viewer !== undefined && isOwnList(selection, viewer);
  const fieldFiltered = Object.values(address.filters ?? {}).some((values) => values?.length);
  const filtered = fieldFiltered || (selection.length > 0 && !own);
  if (searchWordsOf(address.q).length > 0) {
    return {
      title: "Nothing matches this text",
      sentence: "No row holds the text in the search box.",
      clearsFilters: filtered || address.agent !== undefined,
    };
  }
  if (address.show === "dismissed") {
    return {
      title: "Nothing dismissed",
      sentence: "Threads that you dismiss show here.",
      clearsFilters: false,
    };
  }
  if (address.agent !== undefined) {
    return {
      title: `No open asks from ${agentName ?? address.agent}`,
      sentence: "New asks from this agent show here.",
      clearsFilters: true,
    };
  }
  if (credentialsHold) return undefined;
  if (filtered) {
    return {
      title: "Nothing matches this filter",
      sentence: "No row matches the filters that you chose.",
      clearsFilters: true,
    };
  }
  return own
    ? {
        title: "Nothing needs you",
        sentence: "New asks and replies for you show here.",
        clearsFilters: false,
      }
    : {
        title: "Nothing needs anyone",
        sentence: "Open asks for each person show here.",
        clearsFilters: false,
      };
}
