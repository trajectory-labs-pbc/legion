import { useQuery } from "@tanstack/react-query";
import { useNeedsYouCount } from "@/upstream/data-hooks";
import { credentialPendingQuery, inboxQuery, myRepliesCountQuery } from "@/upstream/queries";
import { readFailureOf } from "./read-failure";
import { isPerson, useAskSessionAgain, useSession } from "./session";
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
  const inbox = useQuery(inboxQuery());
  const session = useSession();
  const human = isPerson(session);
  const credentials = useQuery(credentialPendingQuery());
  const replies = useQuery({ ...myRepliesCountQuery(), enabled: human });
  const waiting = useNeedsYouCount();
  const askSessionAgain = useAskSessionAgain();
  const reads = human ? [inbox, credentials, replies] : [inbox, credentials];
  if (session.state !== "ready" || reads.some((read) => read.data === undefined)) {
    // With no secrets broker the list is held, never asked again, so a Retry leaves it alone.
    const retried =
      credentials.data === null ? reads.filter((read) => read !== credentials) : reads;
    const fault = readFailureOf(...retried);
    // The count is made with the session, so its Retry asks the session again too.
    const retry = () => {
      askSessionAgain();
      fault?.retry();
    };
    return { data: undefined, fault: fault && { retrying: fault.retrying, retry } };
  }
  return { data: { waiting, unread: replies.data ?? 0 }, fault: undefined };
}
