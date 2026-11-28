import type { AskUrgency, IssuePriority } from "@/upstream/contract";
import {
  askUrgency,
  dimensionValue,
  dimensionValueLabel,
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

/** The owning issue's priority, with its word: P0 to P3, or No priority. */
export interface RowPriority {
  value: IssuePriority | null;
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
  priority: RowPriority;
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
    priority: {
      value: rowPriority(row),
      // The viewer names only a row's assignee, never its priority.
      label: dimensionValueLabel("priority", dimensionValue(row, "priority", "")),
    },
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
    actor: actorOf(row.ask.last_reply?.author ?? row.ask.author),
    urgency: { value: urgency, label: URGENCY_LABELS[urgency] },
  };
}

/** A row's words: its owner and title on line one, and its preview on line two (INB-39). */
export interface RowText {
  /** The issue's key, the document's project, or an Agent row's session. */
  owner: string | undefined;
  title: string;
  preview: string;
}

const firstLine = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "") ?? "";

/**
 * An ask: its issue or document, and the question's first line. A thread: its owner, its subject,
 * and the last writer with the newest message's first line (INB-49).
 */
export function rowText(row: InboxListRow): RowText {
  if (row.kind === "ask") {
    const { issue, document, question } = row.ask;
    const line = firstLine(question);
    const title = issue?.title ?? document?.name;
    return {
      owner: issue?.key ?? document?.project,
      title: title ?? line,
      preview: title === undefined ? "" : line,
    };
  }
  const { issue, document, session, subject, reply } = row.thread;
  const writer = reply.author.kind === "user" ? reply.author.id : (session?.name ?? "Agent");
  return {
    owner: issue?.key ?? document?.project ?? session?.name,
    title: subject,
    preview: `${writer}: ${reply.first_line}`,
  };
}
