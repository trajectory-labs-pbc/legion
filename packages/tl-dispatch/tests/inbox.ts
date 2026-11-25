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
