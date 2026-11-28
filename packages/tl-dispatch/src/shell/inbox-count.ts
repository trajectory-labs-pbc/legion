import { useInboxCount } from "@/data/inbox-count";
import { needsYouLabel } from "@/features/needs-you";
import type { RowCount } from "./row-count";

/**
 * The Inbox's number wherever it is drawn: what waits on the reader, in the mark; else the unread
 * threads, muted. It shows no number until each read it needs has answered.
 */
export function useInboxRowCount(): RowCount {
  const inbox = useInboxCount();
  if (inbox.data === undefined) return { count: undefined, needsYou: true, fault: inbox.fault };
  const { waiting, unread } = inbox.data;
  if (waiting > 0 || unread === 0) {
    return { count: waiting, needsYou: true, label: needsYouLabel(waiting) };
  }
  return {
    count: unread,
    needsYou: false,
    label: unread === 1 ? "1 unread thread" : `${unread} unread threads`,
  };
}
