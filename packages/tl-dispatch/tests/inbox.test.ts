import { expect, test } from "bun:test";
import { ApiError, api } from "@/upstream/api";

import {
  ANSWERED_ASK,
  INBOX_ASKS,
  INBOX_READS,
  inboxReads,
  PENDING_CREDENTIAL_REQUEST,
  UNREAD_THREAD,
} from "./inbox";
import { answerReads, brokerUnreachable, readFailed, waitFor } from "./network";
import { isDecisionAsk } from "./upstream";
import { reader } from "./writes";

const refusal = (read: Promise<unknown>) =>
  read.then(
    () => undefined,
    (error: unknown) => (error instanceof ApiError ? [error.status, error.code] : error)
  );

test("upstream's client reads each Inbox read's rows in the server's shape", async () => {
  const asks = Object.values(INBOX_ASKS);
  answerReads(
    INBOX_READS,
    inboxReads({
      answers: () => [ANSWERED_ASK],
      credentialRequests: () => [PENDING_CREDENTIAL_REQUEST],
      inbox: () => asks,
      replies: () => [UNREAD_THREAD],
    })
  );
  expect(await api.whoAmI()).toEqual(reader);
  expect(await api.getInbox()).toEqual(asks);
  expect((await api.listMyReplies({ state: "inbox" })).rows).toEqual([UNREAD_THREAD]);
  expect((await api.listMyAnswers({})).rows).toEqual([ANSWERED_ASK]);
  expect(await api.getCredentialPending()).toEqual({ pending: [PENDING_CREDENTIAL_REQUEST] });
});

test("a refused read reaches upstream's client as the server's refusal", async () => {
  answerReads(
    INBOX_READS,
    inboxReads({ credentialRequests: brokerUnreachable, inbox: readFailed })
  );
  expect(await refusal(api.getInbox())).toEqual([500, "INTERNAL"]);
  expect(await refusal(api.getCredentialPending())).toEqual([503, "AGENT_SECRETS_UNAVAILABLE"]);
});

test("a held read stays out", async () => {
  const { asked } = answerReads(INBOX_READS, inboxReads({ inbox: () => undefined }));
  let ended = false;
  const end = () => {
    ended = true;
  };
  api.getInbox().then(end, end);
  await waitFor(() => asked.length === 1);
  await api.listMyAnswers({});
  expect(ended).toBe(false);
});

test("upstream reads the decision row as a decision block, and no other row", () => {
  const decisions = Object.values(INBOX_ASKS).filter((ask) => isDecisionAsk(ask));
  expect(decisions.map((ask) => ask.id)).toEqual([INBOX_ASKS.decisionInDocument.id]);
});
