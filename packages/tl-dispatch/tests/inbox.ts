import type {
  AskAnswerWithTrees,
  AskWithTrees,
  AuthenticatedUser,
  CredentialPendingResponse,
  CredentialPendingRow,
  InboxRow,
  MyAnswerRow,
  MyAnswersResponse,
  MyRepliesResponse,
  MyReplyRow,
} from "@upstream-dispatch/api/types";

import { answerPath, type Endings, json, type Refusal, type Reply, route } from "./network";
import { reader } from "./writes";

/** The time each fixture row was written, the hour before its answer. */
const ASKED_AT = "2026-11-25T08:00:00Z";
const ANSWERED_AT = "2026-11-25T09:00:00Z";

/** An open question on an issue the reader holds, with no options and no thread yet. */
export function askRow(overrides: Partial<InboxRow> = {}): InboxRow {
  return {
    anchor: null,
    answer: null,
    artifact_id: null,
    asked_of: null,
    asked_of_at: null,
    asked_of_by: null,
    author: { id: "session-1", kind: "session" },
    block_id: null,
    created_at: ASKED_AT,
    edited_at: null,
    id: "ask-1",
    issue: { assignee: reader.login, key: "CORE-1", title: "Release train" },
    issue_key: "CORE-1",
    kind: "question",
    last_reply: null,
    multiple: false,
    opened_event_id: 1,
    options: [],
    priority: null,
    question: "Which release path?",
    snoozed_until: null,
    state: "open",
    thread: {
      answers: [],
      claimant: null,
      edits: [],
      followers: [],
      replies: [],
      route: null,
      route_holder: null,
      route_status: null,
      route_status_reason: null,
    },
    urgency: "med",
    waiting_on: "human",
    waiting_on_person: reader.login,
    ...overrides,
  };
}

/** Each kind of open ask the Inbox lists, waiting on the reader, each with its own id. */
export const INBOX_ASKS = {
  withOptions: askRow({
    id: "ask-options",
    options: [
      { description: "Release today from main.", label: "Ship" },
      { description: "Wait for the retry fix.", label: "Hold" },
    ],
  }),
  oneChoice: askRow({
    id: "ask-one-choice",
    options: [{ label: "Staging" }, { label: "Production" }, { label: "Both" }],
    question: "Where does the canary run?",
  }),
  severalChoices: askRow({
    id: "ask-several-choices",
    multiple: true,
    options: [{ label: "Linux" }, { label: "macOS" }, { label: "Windows" }],
    question: "Which platforms get the build?",
  }),
  noOptions: askRow({ id: "ask-no-options", question: "What should the release note say?" }),
  approval: askRow({
    approval: {
      artifact_id: "artifact-1",
      documents: null,
      name: "spec.md",
      requested_version: 12,
      version: 12,
    },
    approval_artifact: { name: "spec.md", primary: true, project: "CORE", slug: "spec-md" },
    id: "ask-approval",
    kind: "approval",
    options: [{ label: "Approve" }, { label: "Request changes" }],
    question: "Approve spec.md (version 12)?",
  }),
  decisionInDocument: askRow({
    artifact_id: "artifact-2",
    block_artifact: { id: "artifact-2", primary: false, slug: "design-notes" },
    block_id: "block-1",
    document: { name: "Design notes", project: "CORE", slug: "design-notes" },
    id: "ask-decision",
    issue: undefined,
    issue_key: null,
    options: [{ label: "Postgres" }, { label: "Redis" }],
    question: "Which store holds the cache?",
  }),
} satisfies Record<string, InboxRow>;

/** The reader's answer to `ask`: `selected` options and `text`. */
export const answerOf = (
  selected: readonly string[],
  text: string | null = null
): AskAnswerWithTrees => ({ at: ANSWERED_AT, selected: [...selected], text, user: reader.login });

/** `ask` once `answer` closed it: what the answer write gives back. */
export const answeredAsk = (ask: InboxRow, answer: AskAnswerWithTrees): AskWithTrees => ({
  ...ask,
  answer,
  state: "answered",
});

/** An ask the reader answered, as the answers read and the ask's own read give it. */
export const ANSWERED_ASK = answeredAsk(
  { ...INBOX_ASKS.withOptions, id: "ask-answered" },
  answerOf(["Ship"], "Go now.")
);

/** The answers read's row for the reader's answer to `ask`, an ask on CORE-1. */
export function answerRow(ask: AskWithTrees): MyAnswerRow {
  return {
    answer: ask.answer ?? undefined,
    ask_id: ask.id,
    ask_kind: ask.kind,
    ask_state: ask.state,
    at: ask.answer?.at ?? ANSWERED_AT,
    current: true,
    edited_at: null,
    kind: "answer",
    owner: { issue: { key: "CORE-1", title: "Release train" } },
    question: ask.question,
    ref: `/issues/CORE-1/asks/${ask.id}`,
  };
}

/** A comment thread on an issue with two replies the reader has not read. */
export function threadRow(overrides: Partial<MyReplyRow> = {}): MyReplyRow {
  return {
    issue: { key: "CORE-2", title: "Retry budget" },
    kind: "comment",
    project: "CORE",
    read_through: ASKED_AT,
    ref: "/issues/CORE-2?comment=comment-1",
    reply: {
      author: { id: "bob", kind: "user" },
      created_at: ANSWERED_AT,
      first_line: "Agreed, after the fix lands.",
      id: "comment-3",
      kind: "reply",
    },
    subject: "Three attempts is too few",
    thread_id: "comment-1",
    unread: true,
    unread_count: 2,
    unread_reply_ids: ["comment-2", "comment-3"],
    version: 1,
    ...overrides,
  };
}

/** A secret request that waits on the reader's decision. */
export function credentialRequest(
  overrides: Partial<CredentialPendingRow> = {}
): CredentialPendingRow {
  return {
    approve_url: "https://secrets.example.com/approve/record-1",
    identifiers: ["DEMO_API_KEY"],
    kind: "agent_secret",
    record_id: "record-1",
    requested_at: ASKED_AT,
    session: { enrollment: null, request: null },
    state: "pending",
    ...overrides,
  };
}

/** The threads read's answer: `rows`, of `total` threads. */
export const repliesAnswer = (rows: MyReplyRow[], total = rows.length): MyRepliesResponse => ({
  as_of: ANSWERED_AT,
  limit: 50,
  offset: 0,
  rows,
  total,
});

/** The answers read's answer: `rows`, of `total` answers. */
export const answersAnswer = (rows: MyAnswerRow[], total = rows.length): MyAnswersResponse => ({
  limit: 50,
  offset: 0,
  rows,
  total,
});

/** The credential requests read's answer. */
export const credentialRequestsAnswer = (
  pending: CredentialPendingRow[]
): CredentialPendingResponse => ({ pending });

/** The refusal of a read the person scope guards. */
const SCOPE_REFUSAL: Refusal = {
  code: "OAUTH_SCOPE_REQUIRED",
  error: "this route needs the person scope",
  status: 403,
};

/**
 * The Inbox's reads, each with an answer and a refusal that Dispatch gives. The inbox answers
 * each kind of open ask, the threads one unread thread, the answers one answer, and the
 * credential requests one pending request.
 */
export const INBOX_READS = {
  answers: route("get", "/api/v1/me/answers", {
    answer: answersAnswer([answerRow(ANSWERED_ASK)]),
    refusal: SCOPE_REFUSAL,
  }),
  credentialRequests: route("get", "/api/v1/credential-requests", {
    answer: credentialRequestsAnswer([credentialRequest()]),
    refusal: {
      code: "AGENT_SECRETS_UNAVAILABLE",
      error: "the secrets broker is unreachable",
      status: 503,
    },
  }),
  inbox: route("get", "/api/v1/inbox", {
    answer: Object.values(INBOX_ASKS),
    refusal: SCOPE_REFUSAL,
  }),
  replies: route("get", "/api/v1/me/replies", {
    answer: repliesAnswer([threadRow()]),
    refusal: SCOPE_REFUSAL,
  }),
};

/**
 * The Inbox's writes, each with an answer and a refusal that Dispatch gives. A bulk snooze is one
 * `snooze` for each ask, a bulk Mark read one `threadRead` for each thread, and a bulk dismiss or
 * Move to Inbox one `dismiss` that names its rows. Assign to me is a `handOn` to the reader.
 */
export const INBOX_WRITES = {
  answer: route("post", "/api/v1/asks/{id}/answer", {
    answer: answeredAsk(INBOX_ASKS.withOptions, answerOf(["Ship"])),
    refusal: { code: "ASK_CLOSED", error: "ask is already answered", status: 409 },
  }),
  credentialDismiss: route("post", "/api/v1/credential-requests/{id}/dismiss", {
    answer: { dismissed_at: ANSWERED_AT, dismissed_by: reader.login, record_id: "record-1" },
    refusal: {
      code: "RECORD_PENDING",
      error: "request has not expired; it can still be decided",
      status: 409,
    },
  }),
  decline: route("post", "/api/v1/asks/{id}/decline", {
    answer: {
      ...INBOX_ASKS.noOptions,
      resolution: {
        actor: { id: reader.login, kind: "user" },
        at: ANSWERED_AT,
        kind: "declined",
        reason: "",
      },
      state: "declined",
    },
    refusal: {
      code: "ASK_NOT_DECLINABLE",
      error: "an approval request is answered with Approve or Request changes; it is not declined",
      status: 409,
    },
  }),
  dismiss: route("post", "/api/v1/me/inbox/dismiss", {
    answer: { dismissed: 1 },
    refusal: { code: "INVALID_STATE", error: "dismiss_through is required", status: 400 },
  }),
  handOn: route("put", "/api/v1/asks/{id}/asked-of", {
    answer: {
      ...INBOX_ASKS.withOptions,
      asked_of: reader.login,
      asked_of_at: ANSWERED_AT,
      asked_of_by: reader.login,
    },
    refusal: {
      code: "ASK_NOT_OPEN",
      error: "only open asks may be handed to another person",
      status: 409,
    },
  }),
  inboxRead: route("post", "/api/v1/me/inbox/read", {
    answer: { marked: 1 },
    refusal: { code: "INVALID_STATE", error: "read_through is required", status: 400 },
  }),
  snooze: route("put", "/api/v1/me/asks/{id}/snooze", {
    answer: { snoozed_until: "2026-11-26T08:00:00Z" },
    refusal: { code: "SNOOZE_INPUT", error: "snoozed_until must be in the future", status: 400 },
  }),
  threadRead: route("put", "/api/v1/me/threads/{id}/read", {
    answer: undefined,
    refusal: { code: "INVALID_STATE", error: "read_through is required", status: 400 },
  }),
  unsnooze: route("delete", "/api/v1/me/asks/{id}/snooze", {
    answer: undefined,
    refusal: { code: "NOT_FOUND", error: "no ask ask-options", status: 404 },
  }),
};

/** The sign-in read, which is not a route of the generated contract: the reader, or no identity. */
export const WHOAMI: Endings<AuthenticatedUser> = {
  answer: reader,
  refusal: { code: "NO_IDENTITY", error: "no identity", status: 401 },
};

/** Gives the sign-in read `reply`, by default the reader. */
export const answerWhoAmI = (reply: Reply<AuthenticatedUser> = { answer: WHOAMI.answer }) =>
  answerPath<AuthenticatedUser, undefined>("get", "/auth/whoami", reply);

/** `GET /api/v1/inbox` with two asks waiting on `reader` and one on someone else. */
export const INBOX_TWO_FOR_READER = [
  askRow({ id: "a1" }),
  askRow({ id: "a2" }),
  askRow({ id: "a3", waiting_on_person: "other" }),
];

/**
 * Answers the reads the Inbox count makes: the viewer `reader`, the inbox as `inbox` answers it
 * (undefined never settles), no credential requests, and `unread` unread threads.
 */
export function inboxReads(inbox: () => Response | undefined, unread: number) {
  return (url: string): Response | undefined => {
    if (url.endsWith("/auth/whoami")) return json(reader);
    if (url.endsWith("/api/v1/inbox")) return inbox();
    if (url.includes("/api/v1/credential-requests")) return json(credentialRequestsAnswer([]));
    if (url.includes("/api/v1/me/replies")) return json(repliesAnswer([], unread));
    return undefined;
  };
}

/** The reads the Inbox count needs, as their addresses start. */
const INBOX_COUNT_READS = [
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
