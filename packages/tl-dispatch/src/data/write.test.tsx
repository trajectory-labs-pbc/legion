import { afterEach, describe, expect, jest, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";

import { ApiError, DispatchQueryClient, NetworkError } from "@/upstream/api";
import type { DispatchEvent } from "@/upstream/contract";
import { useEventFeed } from "@/upstream/live";
import { projectsQuery } from "@/upstream/queries";
import { SendStoppedError, stoppedWriteNote } from "@/upstream/writes";
import { fakeLive } from "../../tests/live";
import { mount } from "../../tests/mount";
import { json, waitFor } from "../../tests/network";
import { settle, sleep } from "../../tests/react";
import { answerRequests, realClock, stopTheLateWrite } from "../../tests/upstream";
import { until } from "../../tests/wait";
import { reader } from "../../tests/writes";
import { type Read, useRead } from "./read";
import { sessionKey } from "./session";
import { patch, type RecordWrite, useWrite, type WriteOptions } from "./write";

const projectsKey = projectsQuery().queryKey;

/** Dispatch's event for a change to project `AB`. */
const projectUpdated = {
  actor: { id: "alice", kind: "user" },
  created_at: "2026-11-01T00:00:00Z",
  id: 1,
  issue_key: null,
  notify: false,
  payload: { key: "AB", name: "Alpha" },
  project: "AB",
  seq: 1,
  type: "project.updated",
} as DispatchEvent;

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

/** What Dispatch holds for the project list: AB is "Alpha" whatever a rename does. */
const alpha = () => json([{ key: "AB", name: "Alpha" }]);

/** A rename of project AB, which `send` makes; its value stands in the project list. */
const renameOf = (send: (name: string) => Promise<unknown>): WriteOptions<unknown, string> => ({
  inline: true,
  label: (name) => `Rename AB to ${name}`,
  method: "PATCH",
  optimistic: (name) => [patch(projectsKey, (rows) => rows?.map((row) => ({ ...row, name })))],
  text: () => ({
    what: "the rename",
    refused: (error) => `Could not rename AB: ${error instanceof Error ? error.message : ""}`,
  }),
  write: send,
});

const projectAB = {
  created_at: "2026-11-01T00:00:00Z",
  gated_steps: null,
  key: "AB",
  name: "Alpha",
  open_asks: 0,
  proven_sessions: false,
};

/** A rename whose value stands in the project list even where the list was never read. */
const creatingRenameOf = (
  send: (name: string) => Promise<unknown>
): WriteOptions<unknown, string> => ({
  ...renameOf(send),
  optimistic: (name) => [
    patch(projectsKey, (rows) =>
      rows === undefined ? [{ ...projectAB, name }] : rows.map((row) => ({ ...row, name }))
    ),
  ],
});

/** A client signed in as the reader, as the shell's is. */
function signedInClient() {
  const client = new DispatchQueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(sessionKey, reader);
  return client;
}

/**
 * The rename of AB, drawn with AB's name where `reads`; a landed rename answers with its own copy.
 * `answer` gives each read of the project list its response; `asked` counts them, and `live`
 * sends events on the page's feed.
 */
function mountRename(
  send: (name: string) => Promise<unknown>,
  {
    answer = alpha,
    reads = true,
    write = renameOf,
  }: {
    answer?: () => Promise<Response> | Response;
    reads?: boolean;
    write?: typeof renameOf;
  } = {}
) {
  let asked = 0;
  answerRequests(
    http.get("/api/v1/projects", () => {
      asked += 1;
      return answer();
    })
  );
  const client = signedInClient();
  const live = fakeLive(client);
  stops.push(live.stop);
  let names: Read<string[]> = { state: "loading" };
  let rename: RecordWrite<string> | undefined;
  function Names() {
    useEventFeed();
    names = useRead(projectsQuery(), { select: (rows) => rows.map((row) => row.name) });
    return null;
  }
  function Rename() {
    rename = useWrite(write(send));
    return null;
  }
  mount(
    <QueryClientProvider client={client}>
      {reads ? <Names /> : null}
      <Rename />
    </QueryClientProvider>
  );
  return {
    asked: () => asked,
    client,
    live,
    name: () => (names.state === "ready" ? names.data[0] : undefined),
    rename: () => {
      if (rename === undefined) throw new Error("the rename is not drawn");
      return rename;
    },
  };
}

/** Dispatch never answers, so the write stays out. */
const unanswered = () => new Promise<never>(() => {});

describe("useWrite", () => {
  test("a read already out when the write patches cannot put the old value back", async () => {
    let release: (() => void) | undefined;
    let reads = 0;
    const page = mountRename(unanswered, {
      answer: () => {
        reads += 1;
        if (reads === 1) return alpha();
        // Dispatch's answer to the second read waits until the test lets it go.
        return new Promise<Response>((resolve) => {
          release = () => resolve(alpha());
        });
      },
    });
    await until(() => page.name() === "Alpha");
    settle(() => void page.client.refetchQueries({ queryKey: projectsKey }));
    await until(() => release !== undefined);
    await settle(async () => page.rename().run("Beta"));
    await settle(async () => release?.());
    await sleep(50);
    expect(page.name()).toBe("Beta");
  });

  test("an optimistic value holds through an event's refresh and a poll while its write is out", async () => {
    const page = mountRename(unanswered);
    await until(() => page.name() === "Alpha");
    await settle(async () => page.rename().run("Beta"));
    expect(page.name()).toBe("Beta");

    let attempts = 0;
    const stopCounting = page.client.onAttempt((hash) => {
      if (hash === page.client.getQueryCache().find({ queryKey: projectsKey })?.queryHash) {
        attempts += 1;
      }
    });
    stops.push(stopCounting);
    page.live.send(projectUpdated);
    // The event's refresh starts a second after the first read, and waits behind the write.
    await waitFor(() => attempts > 0);
    settle(() => void page.client.refetchQueries({ queryKey: projectsKey }));
    await sleep(100);

    expect(page.name()).toBe("Beta");
    expect(page.asked()).toBe(1);
    expect(page.rename().pending).toBe(true);
  });

  test.each([
    ["403", new ApiError(403, { error: "not yours" })],
    ["404", new ApiError(404, { error: "not yours" })],
    ["409 PRIORITY_CHANGED", new ApiError(409, { code: "PRIORITY_CHANGED", error: "not yours" })],
  ])("a write refused %s puts the server's value back, and says why with no Retry", async (_status, refusal) => {
    const page = mountRename(() => Promise.reject(refusal));
    await until(() => page.name() === "Alpha");
    await settle(async () => page.rename().run("Beta"));
    await until(() => page.rename().failure !== undefined && page.name() === "Alpha");
    expect(page.rename()).toMatchObject({
      failure: { text: "Could not rename AB: not yours", retry: undefined },
      refusal,
      unconfirmed: undefined,
    });
  });

  test.each([
    ["422", new ApiError(422, { error: "busy" })],
    ["409 ID_AMBIGUOUS", new ApiError(409, { code: "ID_AMBIGUOUS", error: "busy" })],
  ])("a refusal %s that trying again can cure offers Retry", async (_status, refusal) => {
    const page = mountRename(() => Promise.reject(refusal));
    await until(() => page.name() === "Alpha");
    await settle(async () => page.rename().run("Beta"));
    await until(() => page.rename().failure !== undefined);
    expect(page.rename().failure?.retry).toBeInstanceOf(Function);
  });

  test("a refused write puts the server's value back in a query no view reads", async () => {
    const page = mountRename(() => Promise.reject(new ApiError(403, { error: "not yours" })), {
      reads: false,
    });
    await page.client.fetchQuery(projectsQuery());
    await settle(async () => page.rename().run("Beta"));
    await until(() => page.rename().failure !== undefined);
    await until(() => page.client.getQueryData(projectsKey)?.[0]?.name === "Alpha");
  });

  test("a refused write leaves no value in a key that held none before it", async () => {
    const page = mountRename(() => Promise.reject(new ApiError(403, { error: "not yours" })), {
      reads: false,
      write: creatingRenameOf,
    });
    await settle(async () => page.rename().run("Beta"));
    await until(() => page.rename().failure !== undefined);
    expect(page.client.getQueryData(projectsKey)).toBeUndefined();
  });

  test("a refused write puts the server's value in a key it created that a view reads", async () => {
    let reads = 0;
    const page = mountRename(() => Promise.reject(new ApiError(403, { error: "not yours" })), {
      answer: () => {
        reads += 1;
        return reads === 1 ? unanswered() : alpha();
      },
      write: creatingRenameOf,
    });
    await until(() => reads === 1);
    await settle(async () => page.rename().run("Beta"));
    await until(() => page.rename().failure !== undefined && page.name() === "Alpha");
  });

  test("a refused write keeps a newer press's value in a key it created", async () => {
    let refuse: (() => void) | undefined;
    let reads = 0;
    const page = mountRename(
      (name) =>
        name === "Beta"
          ? new Promise((_resolve, reject) => {
              refuse = () => reject(new ApiError(403, { error: "not yours" }));
            })
          : unanswered(),
      {
        answer: () => {
          reads += 1;
          return reads === 1 ? unanswered() : alpha();
        },
        write: creatingRenameOf,
      }
    );
    await until(() => reads === 1);
    await settle(async () => page.rename().run("Beta"));
    await settle(async () => page.rename().run("Gamma"));
    await until(() => refuse !== undefined && page.name() === "Gamma");
    await settle(async () => refuse?.());
    await sleep(50);
    expect(page.name()).toBe("Gamma");
  });

  test("a landed write reads its keys again", async () => {
    const page = mountRename(async (name) => ({ key: "AB", name }));
    await until(() => page.name() === "Alpha");
    await settle(async () => page.rename().run("Beta"));
    await until(() => page.asked() === 2);
  });

  test("a press the reader stopped may have been made, and its Retry makes it again", async () => {
    jest.useFakeTimers();
    const client = signedInClient();
    let rename: RecordWrite<string> | undefined;
    function Rename() {
      rename = useWrite({
        ...renameOf(() => Promise.reject(new NetworkError("/api/v1/projects/AB", new TypeError()))),
        optimistic: undefined,
      });
      return null;
    }
    try {
      mount(
        <QueryClientProvider client={client}>
          <Rename />
        </QueryClientProvider>
      );
      settle(() => rename?.run("Beta"));
      await stopTheLateWrite(client);
      const stopped = rename?.unconfirmed;
      expect(stopped).toBeInstanceOf(SendStoppedError);
      if (stopped === undefined) return;
      expect(rename?.failure?.text).toBe(
        stoppedWriteNote("the rename", "made", { method: "PATCH", stopped })
      );
      expect(rename?.failure?.retry).toBeInstanceOf(Function);
      expect(rename?.refusal).toBeUndefined();
    } finally {
      realClock();
    }
  });
});
