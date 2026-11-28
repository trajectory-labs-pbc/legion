import type {
  AskAnswerWithTrees,
  CredentialPendingRow,
  InboxRow,
  MyAnswerRow,
  MyReplyRow,
} from "@/upstream/contract";
import { json } from "./network";
import { issueAsk, replyRow } from "./upstream";
import { reader } from "./writes";

const ASKED_AT = "2026-11-25T08:00:00Z";
const ANSWERED_AT = "2026-11-25T09:00:00Z";
const READ_AT = "2026-11-25T10:00:00Z";

export const pathOf = (url: string) => new URL(url, "http://x").pathname;

/** An open ask on the issue CORE-1, which the reader holds, so the ask waits on the reader. */
const readersAsk = (overrides: Partial<InboxRow>, assignee: string = reader.login) =>
  issueAsk({
    created_at: ASKED_AT,
    issue: { assignee, key: "CORE-1", title: "Release train" },
    ...overrides,
  });

/** Each kind of open ask the Inbox lists, waiting on the reader. */
export const INBOX_ASKS = {
  withOptions: readersAsk({
    id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c000001",
    options: [
      { description: "Release today from main.", label: "Ship" },
      { description: "Wait for the retry fix.", label: "Hold" },
    ],
    question: "Which release path?",
  }),
  oneChoice: readersAsk({
    id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c000002",
    options: [{ label: "Staging" }, { label: "Production" }, { label: "Both" }],
    question: "Where does the canary run?",
  }),
  severalChoices: readersAsk({
    id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c000003",
    multiple: true,
    options: [{ label: "Linux" }, { label: "macOS" }, { label: "Windows" }],
    question: "Which platforms get the build?",
  }),
  noOptions: readersAsk({
    id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c000004",
    question: "What should the release note say?",
  }),
  approval: readersAsk({
    approval: {
      artifact_id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c0000a1",
      documents: null,
      name: "spec.md",
      requested_version: 12,
      version: 12,
    },
    approval_artifact: { name: "spec.md", primary: true, project: "CORE", slug: "spec-md" },
    id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c000005",
    kind: "approval",
    options: [{ label: "Approve" }, { label: "Request changes" }],
    question: "Approve spec.md (version 12)?",
  }),
  // A document's decision block: no issue, so it waits on the project default, the reader.
  decisionInDocument: issueAsk(
    {
      artifact_id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c0000a2",
      block_artifact: { id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c0000a2", primary: false, slug: "notes" },
      block_id: "block-1",
      created_at: ASKED_AT,
      document: { name: "Design notes", project: "CORE", slug: "notes" },
      id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c000006",
      issue: undefined,
      issue_key: null,
      options: [{ label: "Postgres" }, { label: "Redis" }],
      question: "Which store holds the cache?",
    },
    reader.login
  ),
} satisfies Record<string, InboxRow>;

/** The answers read's row for the reader's answer `answer` to `ask`, owned and linked as the
 *  server names them. */
export function answerRow(ask: InboxRow, answer: AskAnswerWithTrees): MyAnswerRow {
  const { document, issue } = ask;
  return {
    answer,
    ask_id: ask.id,
    ask_kind: ask.kind,
    ask_state: "answered",
    at: answer.at,
    current: true,
    edited_at: ask.edited_at,
    kind: "answer",
    owner: issue ? { issue: { key: issue.key, title: issue.title } } : { document },
    question: ask.question,
    ref: issue
      ? `/issues/${issue.key}/asks/${ask.id}`
      : `/projects/${document?.project}/documents/${document?.slug}?ask=${ask.id}`,
  };
}

/** An ask with options that the reader answered, as the answers read lists it. */
export const ANSWERED_ASK = answerRow(
  { ...INBOX_ASKS.withOptions, id: "0b7d5a52-6f10-4c39-9d7e-3a2f1c000007" },
  { at: ANSWERED_AT, selected: ["Ship"], text: "Go now.", user: reader.login }
);

/** A comment thread with two replies the reader has not read. */
export const UNREAD_THREAD = replyRow("0b7d5a52-6f10-4c39-9d7e-3a2f1c0000c1", {
  unread_count: 2,
});

/** A secret request that waits on the reader's decision. */
export const PENDING_CREDENTIAL_REQUEST: CredentialPendingRow = {
  approve_url: "https://secrets.example.com/approve/record-1",
  identifiers: ["DEMO_API_KEY"],
  kind: "agent_secret",
  record_id: "record-1",
  requested_at: ASKED_AT,
  session: { enrollment: null, request: null },
  state: "pending",
};

/** One read's answer: its rows, a refusal, or undefined to hold the read. */
export type ReadAnswer<T extends readonly unknown[]> = () => T | Response | undefined;

function answerWith<T extends readonly unknown[]>(
  read: ReadAnswer<T>,
  wrap: (rows: T) => unknown = (rows) => rows
): Response | undefined {
  const answer = read();
  if (answer === undefined || answer instanceof Response) return answer;
  return json(wrap(answer));
}

/**
 * Answers the Inbox's reads by address, for `answerShellReads` or `answerReads(INBOX_READS, …)`:
 * the reader signed in, and each read's rows (none by default). `unread` is the threads read's
 * total, which the count reads; it is the number of rows by default.
 */
export function inboxReads({
  answers = () => [],
  credentialRequests = () => [],
  inbox = () => [],
  replies = () => [],
  unread,
}: {
  answers?: ReadAnswer<MyAnswerRow[]>;
  credentialRequests?: ReadAnswer<CredentialPendingRow[]>;
  inbox?: ReadAnswer<InboxRow[]>;
  replies?: ReadAnswer<MyReplyRow[]>;
  unread?: number;
} = {}) {
  return (url: string): Response | undefined => {
    const path = pathOf(url);
    if (path === "/auth/whoami") return json(reader);
    if (path === "/api/v1/inbox") return answerWith(inbox);
    if (path === "/api/v1/credential-requests") {
      return answerWith(credentialRequests, (pending) => ({ pending }));
    }
    if (path === "/api/v1/me/replies") {
      return answerWith(replies, (rows) => ({
        as_of: READ_AT,
        limit: 200,
        offset: 0,
        rows,
        total: unread ?? rows.length,
      }));
    }
    if (path === "/api/v1/me/answers") {
      return answerWith(answers, (rows) => ({ limit: 50, offset: 0, rows, total: rows.length }));
    }
    return undefined;
  };
}

/** `GET /api/v1/inbox` with two asks waiting on `reader` and one on someone else. */
export const INBOX_TWO_FOR_READER = [
  readersAsk({ id: "a1" }),
  readersAsk({ id: "a2" }),
  readersAsk({ id: "a3" }, "other"),
];

/** The reads the Inbox count needs, as their addresses start. */
const INBOX_COUNT_READS = [
  "/auth/whoami",
  "/api/v1/inbox",
  "/api/v1/credential-requests",
  "/api/v1/me/replies",
];

/** The Inbox's reads: the count's, and the answers. */
export const INBOX_READS = [...INBOX_COUNT_READS, "/api/v1/me/answers"];

/** Which of the Inbox count's reads no address in `asked` names. */
export const unasked = (asked: readonly string[]) =>
  INBOX_COUNT_READS.filter((read) => !asked.some((url) => pathOf(url) === read));
