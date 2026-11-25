import { json } from "./network";

/** An open ask whose turn is a person's, waiting on `person`: the fields the needs-you count reads. */
const waitingAsk = (id: string, person: string) => ({
  id,
  waiting_on: "human",
  waiting_on_person: person,
  snoozed_until: null,
  created_at: "2026-11-25T08:00:00Z",
});

/** `GET /api/v1/inbox` with two asks waiting on `reader` and one on someone else. */
export const INBOX_TWO_FOR_READER = [
  waitingAsk("a1", "reader"),
  waitingAsk("a2", "reader"),
  waitingAsk("a3", "other"),
];

/**
 * Answers the reads the Inbox count makes: the viewer `reader`, the inbox as `inbox` answers it
 * (undefined never settles), no credential requests, and `unread` unread threads.
 */
export function inboxReads(inbox: () => Response | undefined, unread: number) {
  return (url: string): Response | undefined => {
    if (url.endsWith("/auth/whoami")) return json({ kind: "user", login: "reader" });
    if (url.endsWith("/api/v1/inbox")) return inbox();
    if (url.includes("/api/v1/credential-requests")) return json({ pending: [] });
    if (url.includes("/api/v1/me/replies")) return json({ items: [], total: unread });
    return undefined;
  };
}

/** The reads the Inbox count needs, as their addresses start. */
export const INBOX_COUNT_READS = [
  "/auth/whoami",
  "/api/v1/inbox",
  "/api/v1/credential-requests",
  "/api/v1/me/replies",
];

/** Which of the Inbox count's reads no address in `asked` names. */
export const unasked = (asked: readonly string[]) =>
  INBOX_COUNT_READS.filter(
    (read) => !asked.some((url) => new URL(url, "http://x").pathname === read)
  );
