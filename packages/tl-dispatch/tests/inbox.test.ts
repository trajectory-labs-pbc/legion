import { expect, test } from "bun:test";
import { TEST_ORIGIN } from "@upstream-dispatch/__tests__/register-dom";
import { ApiError, api } from "@upstream-dispatch/api/client";
import { routeUrl } from "@upstream-dispatch/api/paths";
import { isDecisionAsk } from "@upstream-dispatch/features/inbox/ask-decision";

import { ANSWERED_ASK, answerWhoAmI, INBOX_ASKS, INBOX_READS, INBOX_WRITES, WHOAMI } from "./inbox";
import { answerRoute, hold, refused, waitFor } from "./network";
import { reader } from "./writes";

const ROUTES = { ...INBOX_READS, ...INBOX_WRITES };

const SNOOZE = { snoozed_until: "2026-11-26T08:00:00Z" };

/** Sends one request on `route`, as the page would, to the ask or thread `id`. */
async function send({ method, path }: { method: string; path: string }, id = "ask-options") {
  const url = new URL(routeUrl(path, path.includes("{id}") ? { id } : {}), TEST_ORIGIN);
  const body = method === "get" || method === "delete" ? undefined : JSON.stringify(SNOOZE);
  const response = await fetch(url, { body, method: method.toUpperCase() });
  const text = await response.text();
  return { body: text === "" ? undefined : JSON.parse(text), status: response.status };
}

test("each kind of open ask waits on the reader, under its own id", () => {
  const asks = Object.values(INBOX_ASKS);
  expect(new Set(asks.map((ask) => ask.id)).size).toBe(asks.length);
  for (const ask of asks) {
    expect([ask.state, ask.waiting_on_person]).toEqual(["open", reader.login]);
  }
  expect(INBOX_ASKS.withOptions.options?.every((option) => option.description)).toBe(true);
  expect(INBOX_ASKS.oneChoice.multiple).toBe(false);
  expect(INBOX_ASKS.severalChoices.multiple).toBe(true);
  expect(INBOX_ASKS.noOptions.options).toEqual([]);
  expect(INBOX_ASKS.approval.kind).toBe("approval");
  expect(asks.filter((ask) => isDecisionAsk(ask)).map((ask) => ask.id)).toEqual(["ask-decision"]);
  expect(INBOX_ASKS.decisionInDocument.issue).toBeUndefined();
  expect([ANSWERED_ASK.state, ANSWERED_ASK.answer?.selected]).toEqual(["answered", ["Ship"]]);
});

test("each read and each write answers with its route's answer", async () => {
  for (const route of Object.values(ROUTES)) {
    answerRoute(route);
    const { body, status } = await send(route);
    expect({ body, path: route.path, status }).toEqual({
      body: route.answer,
      path: route.path,
      status: route.answer === undefined ? 204 : 200,
    });
  }
});

test("each read and each write refuses with its route's refusal", async () => {
  for (const route of Object.values(ROUTES)) {
    answerRoute(route, refused(route));
    const { status, ...refusal } = route.refusal;
    expect({ ...(await send(route)), path: route.path }).toEqual({
      body: refusal,
      path: route.path,
      status,
    });
  }
});

test("a held read or write stays out until it is released", async () => {
  for (const route of Object.values(ROUTES)) {
    const held = hold<(typeof route)["answer"]>();
    const sent = answerRoute(route, held);
    let ended = false;
    const out = send(route).finally(() => {
      ended = true;
    });
    await waitFor(() => sent.length === 1);
    expect({ ended, path: route.path }).toEqual({ ended: false, path: route.path });
    held.release(refused(route));
    expect((await out).status).toBe(route.refusal.status);
  }
});

test("a handler for one ask takes that ask's write from the route's, as in a bulk snooze", async () => {
  const all = answerRoute(INBOX_WRITES.snooze);
  const one = answerRoute(INBOX_WRITES.snooze, refused(INBOX_WRITES.snooze), {
    id: INBOX_ASKS.oneChoice.id,
  });
  const statuses: number[] = [];
  for (const ask of [INBOX_ASKS.withOptions, INBOX_ASKS.oneChoice, INBOX_ASKS.noOptions]) {
    statuses.push((await send(INBOX_WRITES.snooze, ask.id)).status);
  }
  expect(statuses).toEqual([200, 400, 200]);
  expect(one.map((request) => request.body)).toEqual([SNOOZE]);
  expect(all.map((request) => new URL(request.url).pathname)).toEqual([
    "/api/v1/me/asks/ask-options/snooze",
    "/api/v1/me/asks/ask-no-options/snooze",
  ]);
});

test("upstream's client reads each read's answer, and its refusal as an ApiError", async () => {
  const reads = [
    [INBOX_READS.inbox, () => api.getInbox()],
    [INBOX_READS.replies, () => api.listMyReplies({})],
    [INBOX_READS.answers, () => api.listMyAnswers({})],
    [INBOX_READS.credentialRequests, () => api.getCredentialPending()],
  ] as const;
  for (const [route, read] of reads) {
    answerRoute(route);
    expect(await read()).toEqual(route.answer);
    answerRoute(route, refused(route));
    const refusal = await read().catch((error: unknown) => error);
    expect(refusal instanceof ApiError ? refusal.code : refusal).toBe(route.refusal.code);
  }
});

test("the sign-in read answers the reader, or no identity", async () => {
  answerWhoAmI();
  expect(await api.whoAmI()).toEqual(WHOAMI.answer);
  answerWhoAmI({ refusal: WHOAMI.refusal });
  const refusal = await api.whoAmI().catch((error: unknown) => error);
  expect(refusal instanceof ApiError ? refusal.status : refusal).toBe(401);
});
