import type { CredentialPendingResponse, InboxRow, MyRepliesResponse } from "@/upstream/contract";
import {
  credentialPendingQuery,
  inboxQuery,
  inboxThreadsQuery,
  myRepliesCountQuery,
} from "@/upstream/queries";
import { type Read, useRead } from "../read";
import { useSession } from "../session";

// Each read is upstream's query under its key, so upstream's event refresh keeps it fresh.

/** Every open ask the reader can see. */
export function useInboxAsks<T = InboxRow[]>(select?: (asks: InboxRow[]) => T): Read<T> {
  return useRead(inboxQuery(), { select });
}

/** Whether the signed-in principal is a person: the thread reads need the `person` scope. */
function usePerson(): boolean {
  const session = useSession();
  return session.state === "ready" && session.data.kind === "user";
}

/**
 * The reader's own threads, read or not, less those they dismissed. It asks only for a person
 * and while `enabled` (upstream asks nothing for a list narrowed to asks); until then it is
 * loading.
 */
export function useInboxThreads<T = MyRepliesResponse>(
  { enabled = true }: { enabled?: boolean } = {},
  select?: (threads: MyRepliesResponse) => T
): Read<T> {
  const person = usePerson();
  return useRead({ ...inboxThreadsQuery(), enabled: person && enabled }, { select });
}

/** How many of the reader's threads are unread; for a person only, as upstream asks. */
export function useUnreadThreadTotal(): Read<number> {
  return useRead({ ...myRepliesCountQuery(), enabled: usePerson() });
}

/** The credential requests waiting on the reader: `null` is a Dispatch with no secrets broker. */
export function useCredentialRequests<T = CredentialPendingResponse | null>(
  select?: (pending: CredentialPendingResponse | null) => T
): Read<T> {
  return useRead(credentialPendingQuery(), { select });
}
