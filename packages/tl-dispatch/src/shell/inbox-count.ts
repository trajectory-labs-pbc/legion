import { useQuery } from "@tanstack/react-query";
import { inboxQuery, whoAmIQuery } from "@upstream-dispatch/api/queries";
import { useCredentialRequests } from "@upstream-dispatch/features/credentials/pending";
import { useNeedsYouCount } from "@upstream-dispatch/features/inbox/BlockedOnYou";
import { useUnreadThreadCount } from "@upstream-dispatch/features/inbox/useInboxCount";

/** The Inbox's number wherever it is drawn: the sidebar, the narrow header and the issue rail. */
export interface InboxRowCount {
  /** None until the inbox, the credential requests and the viewer are read. */
  count: number | undefined;
  /** It counts what waits on the reader, so it takes the mark. */
  needsYou: boolean;
  label?: string;
}

/**
 * What waits on the reader, in the mark; else, once everything is read, the unread threads, muted.
 * A failed read shows no unread count in its place.
 */
export function useInboxRowCount(): InboxRowCount {
  const inbox = useQuery(inboxQuery()).data;
  const viewer = useQuery(whoAmIQuery()).data?.login;
  const credentials = useCredentialRequests().status;
  const waiting = useNeedsYouCount();
  const unread = useUnreadThreadCount();
  if (inbox === undefined || viewer === undefined || credentials === "loading") {
    return { count: undefined, needsYou: true };
  }
  if (waiting > 0 || unread === 0 || credentials === "failed") {
    return { count: waiting, needsYou: true };
  }
  return {
    count: unread,
    needsYou: false,
    label: unread === 1 ? "1 unread thread" : `${unread} unread threads`,
  };
}
