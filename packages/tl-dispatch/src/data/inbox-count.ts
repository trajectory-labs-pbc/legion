import { useQuery } from "@tanstack/react-query";
import { useNeedsYouCount } from "@/upstream/data-hooks";
import { credentialPendingQuery, inboxQuery, myRepliesCountQuery } from "@/upstream/queries";
import { type KeyedRead, useReadFailure } from "./read-failure";
import { useAskSessionAgain, useSession } from "./session";
import type { ShellRead } from "./shell-read";

/** What the Inbox's number is made of. */
export interface InboxCount {
  readonly waiting: number;
  readonly unread: number;
}

/**
 * What waits on the reader, and for a person the unread threads. It reads the inbox, the
 * session, the credential requests and, for a person, the unread threads, and gives no count until
 * all of them have answered, so a failed read never leaves another count in its place.
 */
export function useInboxCount(): ShellRead<InboxCount> {
  const inboxOptions = inboxQuery();
  const credentialsOptions = credentialPendingQuery();
  const repliesOptions = myRepliesCountQuery();
  const inbox = useQuery(inboxOptions);
  const session = useSession();
  const human = session.state === "ready" && session.data.kind === "user";
  const credentials = useQuery(credentialsOptions);
  const replies = useQuery({ ...repliesOptions, enabled: human });
  const waiting = useNeedsYouCount();
  const askSessionAgain = useAskSessionAgain();
  // With no secrets broker the list is held, never asked again, so a Retry leaves it alone.
  const reads: readonly (KeyedRead | undefined)[] = [
    { read: inbox, key: inboxOptions.queryKey },
    credentials.data === null ? undefined : { read: credentials, key: credentialsOptions.queryKey },
    human ? { read: replies, key: repliesOptions.queryKey } : undefined,
  ];
  const fault = useReadFailure(...reads);
  const unanswered = reads.some((slot) => slot !== undefined && slot.read.data === undefined);
  if (session.state !== "ready" || unanswered) {
    if (fault?.retry === undefined) return { data: undefined, fault };
    // The count is made with the session, so its Retry asks the session again too.
    const retry = () => {
      askSessionAgain();
      fault.retry();
    };
    return { data: undefined, fault: { retrying: fault.retrying, retry } };
  }
  return { data: { waiting, unread: replies.data ?? 0 }, fault: undefined };
}
