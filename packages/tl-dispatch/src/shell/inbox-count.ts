import { useQuery } from "@tanstack/react-query";
import { inboxQuery, myRepliesCountQuery, whoAmIQuery } from "@upstream-dispatch/api/queries";
import { credentialPendingQuery } from "@upstream-dispatch/features/credentials/pending";
import { useNeedsYouCount } from "@upstream-dispatch/features/inbox/BlockedOnYou";
import { useIsHuman } from "@upstream-dispatch/hooks/useIsHuman";
import { needsYouLabel } from "@/features/needs-you";
import { retryOf } from "./read-line";
import type { RowCount } from "./row-count";

/**
 * The Inbox's number wherever it is drawn: what waits on the reader, in the mark; else the unread
 * threads, muted. It reads the inbox, the viewer, the credential requests and, for a person, the
 * unread threads, and shows no number until all of them have answered, so a failed read never
 * leaves another count in its place.
 */
export function useInboxRowCount(): RowCount {
  const human = useIsHuman();
  const inbox = useQuery(inboxQuery());
  const viewer = useQuery(whoAmIQuery());
  const credentials = useQuery(credentialPendingQuery());
  const replies = useQuery({ ...myRepliesCountQuery(), enabled: human });
  const waiting = useNeedsYouCount();
  const reads = human ? [inbox, viewer, credentials, replies] : [inbox, viewer, credentials];
  if (reads.some((read) => read.data === undefined)) {
    return { count: undefined, needsYou: true, retry: retryOf(...reads) };
  }
  const unread = replies.data ?? 0;
  if (waiting > 0 || unread === 0) {
    return { count: waiting, needsYou: true, label: needsYouLabel(waiting) };
  }
  return {
    count: unread,
    needsYou: false,
    label: unread === 1 ? "1 unread thread" : `${unread} unread threads`,
  };
}
