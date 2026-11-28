import type { CredentialPendingResponse } from "@/upstream/contract";
import { awaitsDecision, capSearchQuery, searchWords } from "@/upstream/logic/inbox";
import type { Read } from "../read";

export { isOwnList } from "@/upstream/logic/inbox";

/** The words the search box narrows the list by, as upstream reads `?q=`. */
export const searchWordsOf = (q: string | undefined): readonly string[] =>
  searchWords(capSearchQuery(q ?? ""));

/**
 * Whether the credential requests keep the list from saying it is empty: while they load, after
 * they fail, or while one waits on a decision. An expired request waits on nobody (INB-34).
 */
export function credentialsHoldEmptyList(read: Read<CredentialPendingResponse | null>): boolean {
  return read.state !== "ready" || (read.data?.pending ?? []).some(awaitsDecision);
}
