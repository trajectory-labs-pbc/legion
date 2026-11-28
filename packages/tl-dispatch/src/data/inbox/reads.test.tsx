import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { sessionKey } from "@/data/session";
import {
  INBOX_ASKS,
  INBOX_READS,
  inboxReads,
  PENDING_CREDENTIAL_REQUEST,
  pathOf,
  UNREAD_THREAD,
} from "../../../tests/inbox";
import { mount } from "../../../tests/mount";
import { answerReads, json, readFailed, waitFor } from "../../../tests/network";
import { settle } from "../../../tests/react";
import { reader, signedInClient } from "../../../tests/writes";
import type { Read } from "../read";
import {
  useCredentialRequests,
  useInboxAsks,
  useInboxThreads,
  useUnreadThreadTotal,
} from "./reads";

/** Answers with `first`, then fails every read after it. */
const thenFails = <T,>(first: T) => {
  let asked = 0;
  return () => (asked++ === 0 ? first : readFailed());
};

/** Draws `useHook` in `client`; `read` is its newest state. */
function mountRead<T>(useHook: () => Read<T>, client: QueryClient = signedInClient()) {
  let read: Read<T> = { state: "loading" };
  function Probe() {
    read = useHook();
    return null;
  }
  mount(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );
  return { client, read: () => read };
}

/** Reads once, refreshes into a failure, and gives the read after the refresh. */
async function refreshIntoFailure<T>(useHook: () => Read<T>): Promise<Read<T>> {
  const { client, read } = mountRead(useHook);
  await waitFor(() => read().state === "ready");
  await settle(() => client.refetchQueries({ type: "active" }));
  return read();
}

const asks = [INBOX_ASKS.withOptions, INBOX_ASKS.noOptions];

/** The reads of the reader's threads among `asked`. */
const repliesAsked = (asked: readonly string[]) =>
  asked.filter((url) => pathOf(url) === "/api/v1/me/replies");

describe("the Inbox's reads", () => {
  test("a failed refresh of each read keeps its data and says why", async () => {
    answerReads(
      INBOX_READS,
      inboxReads({
        credentialRequests: thenFails([PENDING_CREDENTIAL_REQUEST]),
        inbox: thenFails(asks),
        replies: thenFails([UNREAD_THREAD]),
      })
    );
    const results = {
      asks: await refreshIntoFailure(() => useInboxAsks((rows) => rows.map((row) => row.id))),
      threads: await refreshIntoFailure(() =>
        useInboxThreads({ select: (page) => page.rows?.length })
      ),
      credentials: await refreshIntoFailure(() =>
        useCredentialRequests((answer) => answer?.pending?.length)
      ),
    };
    expect(results.asks).toMatchObject({ state: "ready", data: asks.map((row) => row.id) });
    expect(results.threads).toMatchObject({ state: "ready", data: 1 });
    expect(results.credentials).toMatchObject({ state: "ready", data: 1 });
    for (const result of Object.values(results)) {
      expect(result.state === "ready" && result.refreshError).toBeInstanceOf(Error);
    }
  });

  test("the unread total keeps its number when its refresh fails", async () => {
    answerReads(INBOX_READS, inboxReads({ replies: thenFails([UNREAD_THREAD]), unread: 3 }));
    const read = await refreshIntoFailure(useUnreadThreadTotal);
    expect(read).toMatchObject({ state: "ready", data: 3 });
    expect(read.state === "ready" && read.refreshError).toBeInstanceOf(Error);
  });

  test.each([
    ["no one is signed in", () => json({ code: "UNAUTHORIZED", error: "unauthorized" }, 401)],
    ["an agent is signed in", () => json({ ...reader, kind: "agent" })],
  ])("the thread reads ask nothing while %s", async (_, whoami) => {
    const answer = inboxReads({ replies: () => [UNREAD_THREAD] });
    const { asked } = answerReads(INBOX_READS, (url) =>
      pathOf(url) === "/auth/whoami" ? whoami() : answer(url)
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const threads = mountRead(() => useInboxThreads(), client);
    const unread = mountRead(useUnreadThreadTotal, client);
    const asksRead = mountRead(() => useInboxAsks(), client);
    await waitFor(
      () =>
        asksRead.read().state === "ready" &&
        client.getQueryState(sessionKey)?.fetchStatus === "idle" &&
        client.getQueryState(sessionKey)?.status !== "pending"
    );
    expect(repliesAsked(asked)).toEqual([]);
    expect(threads.read().state).toBe("loading");
    expect(unread.read().state).toBe("loading");
  });

  test("a thread read the list turns off asks nothing, and one left on asks", async () => {
    const { asked } = answerReads(INBOX_READS, inboxReads({ replies: () => [UNREAD_THREAD] }));
    const off = mountRead(() => useInboxThreads({ enabled: false }));
    const on = mountRead(() => useInboxThreads());
    await waitFor(() => on.read().state === "ready");
    expect(repliesAsked(asked)).toHaveLength(1);
    expect(off.read().state).toBe("loading");
  });
});
