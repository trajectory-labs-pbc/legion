import { afterEach, expect, test } from "bun:test";
import {
  notifyManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useQueries,
  useQuery,
} from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ApiError,
  DispatchQueryClient,
  NetworkError,
  NO_ROUTE_ROLLING_RELEASE_MESSAGE,
  RequestTimeoutError,
} from "@/upstream/api";

import { ReadFailure, readRetry, refreshFailureOf, useReadFailure } from "./read-failure";

afterEach(() => {
  onlineManager.setOnline(true);
  cleanup();
});

const answered = (status: number, error = "no") =>
  new ApiError(status, { code: status === 404 ? "NOT_FOUND" : "X", error });
const NO_ROUTE = "no route for GET /api/v1/rows";

/** Reads that each ask `answers[i]`, and the failure they make together. */
function Failure({ answers }: { answers: readonly (() => Promise<unknown>)[] }) {
  const reads = useQueries({
    queries: answers.map((answer, index) => ({ queryKey: ["read", index], queryFn: answer })),
  });
  const fault = useReadFailure(...reads.map((read, index) => ({ read, key: ["read", index] })));
  return (
    <>
      <p data-testid="fetching">{reads.map((read) => read.fetchStatus).join(" ")}</p>
      {fault === undefined ? null : <ReadFailure fault={fault} noun="the rows" />}
    </>
  );
}

function mount(
  answers: readonly (() => Promise<unknown>)[],
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
): QueryClient {
  render(
    <QueryClientProvider client={client}>
      <Failure answers={answers} />
    </QueryClientProvider>
  );
  return client;
}

const LOAD = "Could not load the rows.";
for (const [name, errors, line, retry] of [
  ["a 500", [answered(500)], LOAD, true],
  [
    "a dropped connection",
    [new NetworkError("/rows", new TypeError("Failed to fetch"))],
    LOAD,
    true,
  ],
  ["a time-out", [new RequestTimeoutError("/rows", 10_000)], LOAD, true],
  ["a no-route 404", [answered(404, NO_ROUTE)], LOAD, true],
  [
    "a no-route 404 at the end of a rolling release",
    [answered(404, NO_ROUTE_ROLLING_RELEASE_MESSAGE)],
    LOAD,
    true,
  ],
  ["a 403", [answered(403)], "You cannot see the rows.", false],
  ["a 404", [answered(404)], "Could not find the rows.", false],
  ["a 404 beside a 403", [answered(404), answered(403)], "You cannot see the rows.", false],
  ["a 500 beside a 404", [answered(500), answered(404)], LOAD, true],
] as const) {
  test(`read-failure: ${name} draws its line, with Retry only if asking again can work`, async () => {
    mount(errors.map((error) => () => Promise.reject(error)));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(retry ? `${line}Retry` : line);
  });
}

test("read-failure: the retry policy never asks a refused read again by itself", () => {
  const errors = [
    answered(500),
    answered(404, NO_ROUTE_ROLLING_RELEASE_MESSAGE),
    answered(403),
    answered(404),
  ];
  expect(errors.map((error) => readRetry(0, error))).toEqual([true, true, false, false]);
});

test("read-failure: a refused read keeps its refusal, with no Retry, while it is asked again", async () => {
  let answer = () => Promise.reject(answered(403));
  const client = mount([() => answer()]);
  expect((await screen.findByRole("alert")).textContent).toBe("You cannot see the rows.");

  const again = Promise.withResolvers<never>();
  answer = () => again.promise;
  await act(async () => {
    void client.refetchQueries();
  });
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("fetching"));
  expect(screen.getByRole("alert").textContent).toBe("You cannot see the rows.");

  await act(async () => again.reject(answered(403)));
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("idle"));
  expect(screen.getByRole("alert").textContent).toBe("You cannot see the rows.");
});

test("read-failure: a read refused before it mounts is loading until it answers again", async () => {
  let answer = () => Promise.reject(answered(403));
  const client = mount([() => answer()]);
  expect((await screen.findByRole("alert")).textContent).toBe("You cannot see the rows.");
  cleanup();

  const again = Promise.withResolvers<never>();
  answer = () => again.promise;
  mount([() => answer()], client);
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("fetching"));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

  await act(async () => again.reject(answered(403)));
  expect((await screen.findByRole("alert")).textContent).toBe("You cannot see the rows.");
});

/** What each render of `Picked` drew: its failure, or `none`. */
const drawn: string[] = [];

/** One read of the version the reader picked, and its failure. */
function Picked({
  version,
  answer,
}: {
  version: string;
  answer: (version: string) => Promise<unknown>;
}) {
  const read = useQuery({ queryKey: ["version", version], queryFn: () => answer(version) });
  const fault = useReadFailure({ read, key: ["version", version] });
  drawn.push(fault === undefined ? "none" : (fault.refusal ?? "retryable"));
  return (
    <>
      <p data-testid="fetching">{read.fetchStatus}</p>
      {fault === undefined ? null : <ReadFailure fault={fault} noun="the rows" />}
    </>
  );
}

test("read-failure: a read picked again never shows the refusal of the read picked before it", async () => {
  const again = Promise.withResolvers<never>();
  const answers: Record<string, () => Promise<unknown>> = {
    v8: () => Promise.reject(answered(500)),
    v12: () => Promise.reject(answered(403)),
  };
  const answer = (version: string) => answers[version]?.() ?? Promise.reject(answered(500));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const pick = (version: string) => (
    <QueryClientProvider client={client}>
      <Picked answer={answer} version={version} />
    </QueryClientProvider>
  );
  const view = render(pick("v8"));
  expect((await screen.findByRole("alert")).textContent).toBe(`${LOAD}Retry`);
  view.rerender(pick("v12"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("You cannot see the rows.")
  );

  answers.v8 = () => again.promise;
  view.rerender(pick("v8"));
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("fetching"));
  expect(screen.queryByRole("alert")).toBeNull();

  await act(async () => again.reject(answered(500)));
  expect((await screen.findByRole("alert")).textContent).toBe(`${LOAD}Retry`);
});

test("read-failure: Retry on a 500 beside a 403 asks both reads again", async () => {
  const asked: [number, number] = [0, 0];
  mount([
    () => {
      asked[0]++;
      return Promise.reject(answered(500));
    },
    () => {
      asked[1]++;
      return Promise.reject(answered(403));
    },
  ]);
  await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(asked).toEqual([2, 2]));
  expect(screen.getByRole("alert").textContent).toBe(`${LOAD}Retry`);
});

test("read-failure: a refusal that answers a Retry takes the focus the Retry had", async () => {
  let error = answered(500);
  mount([() => Promise.reject(error)]);
  const retry = await screen.findByRole("button", { name: "Retry" });
  error = answered(403);
  await userEvent.click(retry);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("You cannot see the rows.")
  );
  expect(document.activeElement).toBe(screen.getByRole("alert"));
});

test("read-failure: a failed read asked again keeps its line while a second ask waits behind the first", async () => {
  let answer = () => Promise.reject(answered(500));
  const client = new DispatchQueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Picked answer={() => answer()} version="v1" />
    </QueryClientProvider>
  );
  expect((await screen.findByRole("alert")).textContent).toBe(`${LOAD}Retry`);

  // The client asks it again, as an event or a window focus does.
  const asked = Promise.withResolvers<never>();
  answer = () => asked.promise;
  await act(async () => {
    void client.refetchQueries();
  });
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("fetching"));
  // Asked while that fetch is out, the client queues one more, which starts as the first fails.
  const queued = Promise.withResolvers<never>();
  answer = () => queued.promise;
  await act(async () => {
    void client.invalidateQueries();
  });

  const mark = drawn.length;
  // In a browser the client tells its readers on a timer, so they hear of the failure only once
  // the queued fetch has started and cleared it; the test setup tells them at once.
  notifyManager.setScheduler((callback) => setTimeout(callback, 0));
  try {
    await act(async () => {
      asked.reject(answered(500));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  } finally {
    notifyManager.setScheduler((callback) => callback());
  }
  expect(drawn.length).toBeGreaterThan(mark);
  expect(drawn.slice(mark)).not.toContain("none");
  expect(screen.getByRole("alert").textContent).toBe(`${LOAD}Retry`);

  await act(async () => queued.reject(answered(500)));
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("idle"));
  expect(drawn.slice(mark)).not.toContain("none");
  expect(screen.getByRole("alert").textContent).toBe(`${LOAD}Retry`);
});

test("read-failure: a read picked again never shows a refusal another read made in the same millisecond", async () => {
  const pending: (() => void)[] = [];
  const answer = (version: string) =>
    new Promise<never>((_, reject) => {
      pending.push(() => reject(answered(version === "v12" ? 403 : 500)));
    });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const pick = (version: string) => (
    <QueryClientProvider client={client}>
      <Picked answer={answer} version={version} />
    </QueryClientProvider>
  );
  const view = render(pick("v12"));
  void client.prefetchQuery({ queryKey: ["version", "v8"], queryFn: () => answer("v8") });
  await waitFor(() => expect(pending).toHaveLength(2));
  const now = Date.now;
  const at = now();
  Date.now = () => at;
  try {
    await act(async () => {
      for (const fail of pending.splice(0)) fail();
    });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("You cannot see the rows.")
    );
  } finally {
    Date.now = now;
  }
  expect(client.getQueryState(["version", "v8"])?.errorUpdatedAt).toBe(at);

  view.rerender(pick("v8"));
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("fetching"));
  expect(screen.queryByRole("alert")).toBeNull();

  await act(async () => pending.splice(0)[0]?.());
  expect((await screen.findByRole("alert")).textContent).toBe(`${LOAD}Retry`);
});

test("read-failure: a Retry held while the browser is offline shows it is busy", async () => {
  let answer = () => Promise.reject(answered(500));
  mount([() => answer()]);
  const retry = await screen.findByRole("button", { name: "Retry" });

  answer = () => new Promise<never>(() => undefined);
  onlineManager.setOnline(false);
  await userEvent.click(retry);
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("paused"));
  expect(screen.getByRole("alert").textContent).toBe(`${LOAD}Retry`);
  expect(screen.getByRole("button", { name: "Retry" }).getAttribute("aria-busy")).toBe("true");
});

/** A read whose rows stay, and its failed refresh. */
function Refresh({ answer }: { answer: () => Promise<unknown> }) {
  const read = useQuery({ queryKey: ["refresh"], queryFn: answer });
  const fault = refreshFailureOf(read);
  return fault === undefined ? null : <ReadFailure fault={fault} noun="the rows" refresh />;
}

test("read-failure: a refresh's Retry held while the browser is offline shows it is busy", async () => {
  let answer = () => Promise.resolve<unknown>(["row"]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Refresh answer={() => answer()} />
    </QueryClientProvider>
  );
  await waitFor(() => expect(client.getQueryData<string[]>(["refresh"])).toEqual(["row"]));
  answer = () => Promise.reject(answered(500));
  await act(async () => {
    void client.refetchQueries();
  });
  const retry = await screen.findByRole("button", { name: "Retry" });

  answer = () => new Promise<never>(() => undefined);
  onlineManager.setOnline(false);
  await userEvent.click(retry);
  await waitFor(() => expect(client.getQueryState(["refresh"])?.fetchStatus).toBe("paused"));
  expect(screen.getByRole("alert").textContent).toBe("Could not refresh the rows.Retry");
  expect(screen.getByRole("button", { name: "Retry" }).getAttribute("aria-busy")).toBe("true");
});
