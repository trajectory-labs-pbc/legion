import { useNeedsYouCount } from "@upstream-dispatch/features/inbox/BlockedOnYou";
import { useUnreadThreadCount } from "@upstream-dispatch/features/inbox/useInboxCount";

/** The Inbox row's number: what waits on the reader, in the mark; else its unread threads, muted. */
export function useInboxRowCount(): { count: number; needsYou: boolean; label?: string } {
  const waiting = useNeedsYouCount();
  const unread = useUnreadThreadCount();
  if (waiting > 0 || unread === 0) return { count: waiting, needsYou: true };
  return {
    count: unread,
    needsYou: false,
    label: unread === 1 ? "1 unread thread" : `${unread} unread threads`,
  };
}
