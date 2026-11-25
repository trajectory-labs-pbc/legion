import { useQuery } from "@tanstack/react-query";
import { inboxQuery, myRepliesCountQuery, whoAmIQuery } from "@upstream-dispatch/api/queries";
import { credentialPendingQuery } from "@upstream-dispatch/features/credentials/pending";
import { useNeedsYouCount } from "@upstream-dispatch/features/inbox/BlockedOnYou";
import { useIsHuman } from "@upstream-dispatch/hooks/useIsHuman";

/** The Inbox's number wherever it is drawn: the sidebar, the narrow header and the issue rail. */
export interface InboxRowCount {
  /** None until every read it needs has answered. */
  count: number | undefined;
  /** It counts what waits on the reader, so it takes the mark. */
  needsYou: boolean;
  label?: string;
  /** A read it needs failed: asks every one of them again. */
  retry?: () => void;
}

/**
 * What waits on the reader, in the mark; else the unread threads, muted. It reads the inbox, the
 * viewer, the credential requests and, for a person, the unread threads, and shows no number
 * until all of them have answered, so a failed read never leaves another count in its place.
 */
export function useInboxRowCount(): InboxRowCount {
  const human = useIsHuman();
  const inbox = useQuery(inboxQuery());
  const viewer = useQuery(whoAmIQuery());
  const credentials = useQuery(credentialPendingQuery());
  const replies = useQuery({ ...myRepliesCountQuery(), enabled: human });
  const waiting = useNeedsYouCount();
  const reads = human ? [inbox, viewer, credentials, replies] : [inbox, viewer, credentials];
  if (reads.some((read) => read.data === undefined)) {
    const failed =
      reads.some((read) => read.data === undefined && read.isError) &&
      !reads.some((read) => read.isFetching);
    if (!failed) return { count: undefined, needsYou: true };
    return {
      count: undefined,
      needsYou: true,
      retry: () => {
        for (const read of reads) void read.refetch();
      },
    };
  }
  const unread = replies.data ?? 0;
  if (waiting > 0 || unread === 0) return { count: waiting, needsYou: true };
  return {
    count: unread,
    needsYou: false,
    label: unread === 1 ? "1 unread thread" : `${unread} unread threads`,
  };
}
