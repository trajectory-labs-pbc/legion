import { describe, expect, test } from "bun:test";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";
import { useState } from "react";

import { DispatchQueryClient, NO_ROUTE_ROLLING_RELEASE_MESSAGE } from "@/upstream/api";
import { issueQuery, projectsQuery } from "@/upstream/queries";
import { mount } from "../../tests/mount";
import { answered, json } from "../../tests/network";
import { settle } from "../../tests/react";
import { answerRequests, holdNotifications } from "../../tests/upstream";
import { until } from "../../tests/wait";
import { type Read, useRead } from "./read";

/** Answers the project list with each of `answers` in turn, the last one from then on. */
function answerProjects(...answers: (() => Response | Promise<Response>)[]): void {
  let asked = 0;
  answerRequests(
    http.get("/api/v1/projects", () => {
      const answer = answers[Math.min(asked, answers.length - 1)];
      asked += 1;
      if (answer === undefined) throw new Error("no answer for the project list");
      return answer();
    })
  );
}

const projects = (...names: string[]) => json(names.map((name) => ({ key: name, name })));
const refused = (status: number) => () => json({ code: "REFUSED", error: "no" }, status);
const failure = refused(500);

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** Draws the project names through `useRead`; `read` is its newest state. */
function mountNames(client = newClient()) {
  let read: Read<string[]> = { state: "loading" };
  function Probe() {
    read = useRead(projectsQuery(), { select: (rows) => rows.map((row) => row.name) });
    return null;
  }
  const view = mount(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );
  return { client, read: () => read, unmount: view.unmount };
}

describe("useRead", () => {
  test("a read that loads and answers draws once while loading and once with its data", async () => {
    answerProjects(() => projects("Alpha"));
    const drawn: string[] = [];
    function Probe() {
      drawn.push(useRead(projectsQuery()).state);
      return null;
    }
    mount(
      <QueryClientProvider client={newClient()}>
        <Probe />
      </QueryClientProvider>
    );
    await until(() => drawn.at(-1) === "ready");
    await settle(async () => {});
    expect(drawn).toEqual(["loading", "ready"]);
  });

  test("a failed refresh keeps the data and says why", async () => {
    answerProjects(() => projects("Alpha"), failure);
    const { client, read } = mountNames();
    await until(() => read().state === "ready");
    await settle(() => client.refetchQueries({ queryKey: projectsQuery().queryKey }));
    const state = read();
    expect(state.state).toBe("ready");
    if (state.state !== "ready") return;
    expect(state.data).toEqual(["Alpha"]);
    expect(state.refreshError).toBeInstanceOf(Error);
  });

  test("a failed first read stays shown while its Retry runs, then gives the data", async () => {
    let answer: (() => void) | undefined;
    answerProjects(
      failure,
      () =>
        new Promise<Response>((resolve) => {
          answer = () => resolve(projects("Alpha"));
        })
    );
    const { read } = mountNames();
    await until(() => read().state === "error");
    expect(read()).toMatchObject({ state: "error", retrying: false });
    const state = read();
    if (state.state === "error") settle(() => state.retry?.());
    await until(() => answer !== undefined);
    expect(read()).toMatchObject({ state: "error", retrying: true });
    await settle(async () => answer?.());
    await until(() => read().state === "ready");
    expect(read()).toEqual({ state: "ready", data: ["Alpha"], refreshError: undefined });
  });

  test("a 403 is forbidden, with no Retry", async () => {
    answerProjects(refused(403));
    const { read } = mountNames();
    await until(() => read().state === "error");
    expect(read()).toMatchObject({ state: "error", refusal: "forbidden" });
    expect(Reflect.get(read(), "retry")).toBeUndefined();
  });

  test("a 404 is not found, with no Retry", async () => {
    answerProjects(refused(404));
    const { read } = mountNames();
    await until(() => read().state === "error");
    expect(read()).toMatchObject({ state: "error", refusal: "not-found" });
    expect(Reflect.get(read(), "retry")).toBeUndefined();
  });

  test("a 400 is invalid, with no Retry", async () => {
    answerProjects(refused(400));
    const { read } = mountNames();
    await until(() => read().state === "error");
    expect(read()).toMatchObject({ state: "error", refusal: "invalid" });
    expect(Reflect.get(read(), "retry")).toBeUndefined();
  });

  test("a 400 INVALID_QUERY is a failure that can be tried again", async () => {
    answerProjects(() => json({ code: "INVALID_QUERY", error: "kind takes reply and agent" }, 400));
    const { read } = mountNames();
    await until(() => read().state === "error");
    expect(Reflect.get(read(), "refusal")).toBeUndefined();
    expect(Reflect.get(read(), "retry")).toBeInstanceOf(Function);
  });

  for (const status of [408, 409, 429]) {
    test(`a ${status} is a failure that can be tried again`, async () => {
      answerProjects(refused(status));
      const { read } = mountNames();
      await until(() => read().state === "error");
      expect(Reflect.get(read(), "refusal")).toBeUndefined();
      expect(Reflect.get(read(), "retry")).toBeInstanceOf(Function);
    });
  }

  test("the rolling-release 404 is a failure that can be tried again", async () => {
    const rolling = answered(404, NO_ROUTE_ROLLING_RELEASE_MESSAGE);
    let read: Read<unknown> = { state: "loading" };
    function Probe() {
      read = useRead({ queryKey: ["rolling"], queryFn: () => Promise.reject(rolling) });
      return null;
    }
    mount(
      <QueryClientProvider client={newClient()}>
        <Probe />
      </QueryClientProvider>
    );
    await until(() => read.state === "error");
    expect(Reflect.get(read, "refusal")).toBeUndefined();
    expect(Reflect.get(read, "retry")).toBeInstanceOf(Function);
  });

  test("a refusal holds while the read is asked again, with no Retry meanwhile", async () => {
    let answer: (() => void) | undefined;
    answerProjects(
      refused(403),
      () =>
        new Promise<Response>((resolve) => {
          answer = () => resolve(refused(403)());
        })
    );
    const { client, read } = mountNames();
    await until(() => read().state === "error");
    settle(() => void client.refetchQueries({ queryKey: projectsQuery().queryKey }));
    await until(() => answer !== undefined);
    expect(read()).toMatchObject({ state: "error", refusal: "forbidden", retrying: true });
    expect(Reflect.get(read(), "retry")).toBeUndefined();
    await settle(async () => answer?.());
    await until(() => Reflect.get(read(), "retrying") === false);
    expect(read()).toMatchObject({ state: "error", refusal: "forbidden" });
  });

  test("a view that mounts again on a refused read shows it loading, not a busy Retry", async () => {
    let answer: (() => void) | undefined;
    answerProjects(
      refused(403),
      () =>
        new Promise<Response>((resolve) => {
          answer = () => resolve(refused(403)());
        })
    );
    const first = mountNames();
    await until(() => first.read().state === "error");
    first.unmount();
    const again = mountNames(first.client);
    await until(() => answer !== undefined);
    expect(again.read()).toEqual({ state: "loading" });
    await settle(async () => answer?.());
    await until(() => again.read().state === "error");
    expect(again.read()).toMatchObject({ state: "error", refusal: "forbidden", retrying: false });
  });

  test("a read whose key changes to one that failed before shows it loading", async () => {
    let answer: (() => void) | undefined;
    let askedOther = 0;
    answerRequests(
      http.get("/api/v1/issues/:key", ({ params }) => {
        if (params.key === "AB-1") return json({ code: "NOT_FOUND", error: "gone" }, 404);
        askedOther += 1;
        if (askedOther === 1) return failure();
        return new Promise<Response>((resolve) => {
          answer = () => resolve(failure());
        });
      })
    );
    const client = newClient();
    await client.fetchQuery(issueQuery("AB-2")).catch(() => undefined);
    const failedAt = client.getQueryState(issueQuery("AB-2").queryKey)?.errorUpdatedAt ?? 0;
    await until(() => Date.now() > failedAt);
    let read: Read<unknown> = { state: "loading" };
    let open: ((key: string) => void) | undefined;
    function Probe() {
      const [key, setKey] = useState("AB-1");
      open = setKey;
      read = useRead(issueQuery(key));
      return null;
    }
    mount(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    );
    await until(() => read.state === "error");
    expect(read).toMatchObject({ state: "error", refusal: "not-found" });
    settle(() => open?.("AB-2"));
    await until(() => answer !== undefined);
    expect(read).toEqual({ state: "loading" });
    await settle(async () => answer?.());
    await until(() => read.state === "error");
    expect(Reflect.get(read, "refusal")).toBeUndefined();
    expect(Reflect.get(read, "retry")).toBeInstanceOf(Function);
  });

  test("a failed read asked again keeps its failure while a second ask waits behind the first", async () => {
    let answer: () => Promise<unknown> = () => Promise.reject(answered(500));
    const client = new DispatchQueryClient({ defaultOptions: { queries: { retry: false } } });
    const drawn: string[] = [];
    function Probe() {
      drawn.push(useRead({ queryKey: ["race"], queryFn: () => answer() }).state);
      return null;
    }
    mount(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    );
    await until(() => drawn.at(-1) === "error");
    // The client asks it again, as an event or a window focus does.
    const asked = Promise.withResolvers<never>();
    answer = () => asked.promise;
    settle(() => void client.refetchQueries());
    await until(() => client.getQueryState(["race"])?.fetchStatus === "fetching");
    // Asked while that fetch is out, the client queues one more, which starts as the first fails.
    const queued = Promise.withResolvers<never>();
    answer = () => queued.promise;
    settle(() => void client.invalidateQueries());
    const mark = drawn.length;
    // A browser tells the readers on a timer, so they hear of the failure only once the queued
    // fetch has started and cleared it.
    const held = holdNotifications();
    try {
      await settle(async () => asked.reject(answered(500)));
      expect(held.held()).toBeGreaterThan(0);
    } finally {
      held.tell();
    }
    await settle(async () => queued.reject(answered(500)));
    await until(() => client.getQueryState(["race"])?.fetchStatus === "idle");
    expect(drawn.length).toBeGreaterThan(mark);
    expect(drawn.slice(mark)).not.toContain("loading");
    expect(drawn.at(-1)).toBe("error");
  });

  test("a Retry the browser holds while offline is running", async () => {
    answerProjects(failure, () => projects("Alpha"));
    const { read } = mountNames();
    await until(() => read().state === "error");
    onlineManager.setOnline(false);
    try {
      const state = read();
      if (state.state === "error") settle(() => state.retry?.());
      expect(read()).toMatchObject({ state: "error", error: null, retrying: true });
    } finally {
      settle(() => onlineManager.setOnline(true));
    }
    await until(() => read().state === "ready");
  });
});
