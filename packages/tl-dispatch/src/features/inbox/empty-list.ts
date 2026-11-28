import { type InboxRoute, isOwnList } from "@/data/inbox/empty-list";

/** The fields of the Inbox's address that decide what an empty list says. */
export type EmptyListAddress = Pick<InboxRoute, "show" | "agent" | "assignees" | "filters">;

/** What an empty list shows: upstream's title, one sentence, and whether Clear filters is its action. */
export interface EmptyList {
  readonly title: string;
  readonly sentence: string;
  readonly clearsFilters: boolean;
}

const said = (title: string, sentence: string, clearsFilters = false): EmptyList => ({
  title,
  sentence,
  clearsFilters,
});

/**
 * What the list says when it has no row, as the spec's table "Empty lists" gives it; nothing while
 * the credential requests hold it. The first case that applies wins: the search text, the
 * Dismissed view, the agent, a filter or another selection of people, the reader's own list, and
 * everyone (INB-30 to INB-34).
 */
export function emptyList({
  address,
  words,
  viewer,
  agentName,
  credentialsHold,
}: {
  address: EmptyListAddress;
  /** The words the search box narrows the list by (`searchWordsOf`), as the list reads them. */
  words: readonly string[];
  /** The signed-in person's email. */
  viewer: string | undefined;
  /** The agent of `?agent=`, in plain text. */
  agentName: string | undefined;
  credentialsHold: boolean;
}): EmptyList | undefined {
  // Absent is the reader's own list, empty is everyone, and a value names a person or `unassigned`.
  const selection = address.assignees ?? (viewer === undefined ? [] : [viewer]);
  const own = viewer !== undefined && isOwnList(selection, viewer);
  const fieldFiltered = Object.values(address.filters ?? {}).some((values) => values?.length);
  const filtered = fieldFiltered || (selection.length > 0 && !own);
  if (words.length > 0) {
    return said(
      "Nothing matches this text",
      "No row holds the text in the search box.",
      filtered || address.agent !== undefined
    );
  }
  if (address.show === "dismissed") {
    return said("Nothing dismissed", "Threads that you dismiss show here.");
  }
  if (address.agent !== undefined) {
    const name = agentName ?? address.agent;
    return said(`No open asks from ${name}`, "New asks from this agent show here.", true);
  }
  if (credentialsHold) return undefined;
  if (filtered) {
    return said("Nothing matches this filter", "No row matches the filters that you chose.", true);
  }
  return own
    ? said("Nothing needs you", "New asks and replies for you show here.")
    : said("Nothing needs anyone", "Open asks for each person show here.");
}
