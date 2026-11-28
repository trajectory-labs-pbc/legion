import type { AskUrgency, IssuePriority } from "@/upstream/contract";
import {
  askUrgency,
  type InboxListRow,
  type InboxRowType,
  rowId,
  rowLastActivityAt,
  rowPriority,
  rowType,
  TYPE_LABELS,
  URGENCY_LABELS,
} from "@/upstream/logic/inbox";

/** An ask's urgency, with its word. */
export interface RowUrgency {
  value: AskUrgency;
  label: string;
}

/** Who wrote the row: a person, by their id, or an agent, which has no face. */
export type RowActor = { agent: true } | { agent: false; id: string };

interface RowBase {
  id: string;
  type: InboxRowType;
  /** The kind's name, as the Type filter gives it. */
  kindLabel: string;
  /** When the row was last written in. */
  at: Date;
  actor: RowActor;
  /** The owning issue's priority. */
  priority: IssuePriority | null;
}

/** What a row of the Inbox shows, read from upstream's row. An ask has an urgency and no unread
 *  mark; a thread has an unread mark and no urgency. */
export type InboxRowFacts = RowBase &
  ({ kind: "ask"; urgency: RowUrgency } | { kind: "thread"; unread: boolean });

const actorOf = (author: { kind: string; id: string }): RowActor =>
  author.kind === "user" ? { agent: false, id: author.id } : { agent: true };

export function rowFacts(row: InboxListRow): InboxRowFacts {
  const type = rowType(row);
  const base = {
    id: rowId(row),
    type,
    kindLabel: TYPE_LABELS[type],
    at: new Date(rowLastActivityAt(row)),
    priority: rowPriority(row),
  };
  if (row.kind === "thread") {
    return {
      ...base,
      kind: "thread",
      actor: actorOf(row.thread.reply.author),
      unread: row.thread.unread,
    };
  }
  const urgency = askUrgency(row.ask.urgency);
  return {
    ...base,
    kind: "ask",
    actor: actorOf(row.ask.author),
    urgency: { value: urgency, label: URGENCY_LABELS[urgency] },
  };
}
