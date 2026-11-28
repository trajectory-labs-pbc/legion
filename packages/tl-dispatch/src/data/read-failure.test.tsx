import { afterEach, expect, test } from "bun:test";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useQueries,
  useQuery,
} from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readRetry } from "@/data/read";
import {
  DispatchQueryClient,
  NetworkError,
  NO_ROUTE_ROLLING_RELEASE_MESSAGE,
  RequestTimeoutError,
} from "@/upstream/api";
import { answered } from "../../tests/network";
import { holdNotifications } from "../../tests/upstream";
import { ReadFailure, refreshFailureOf, useReadFailure } from "./read-failure";

afterEach(() => {
  onlineManager.setOnline(true);
  cleanup();
});

/** What each render of `Failure` drew: its failure, or `none`. */
const drawn: string[] = [];

/** Reads that each ask `answers[i]`, and the failure they make together. */
function Failure({ answers }: { answers: readonly (() => Promise<unknown>)[] }) {
  const reads = useQueries({
    queries: answers.map((answer, index) => ({ queryKey: ["read", index], queryFn: answer })),
  });
  const fault = useReadFailure(...reads);
  drawn.push(fault === undefined ? "none" : (fault.refusal ?? "retryable"));
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
  [
    "a no-route 404 at the end of a rolling release",
    [answered(404, NO_ROUTE_ROLLING_RELEASE_MESSAGE)],
    LOAD,
    true,
  ],
  ["a 408", [answered(408)], LOAD, true],
  ["a 429", [answered(429)], LOAD, true],
  ["a 400", [answered(400)], LOAD, false],
  ["a 400 beside a 404", [answered(400), answered(404)], "Could not find the rows.", false],
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
    answered(400, "kind takes reply and agent", "INVALID_QUERY"),
    answered(400),
    answered(403),
    answered(404),
  ];
  expect(errors.map((error) => readRetry(0, error))).toEqual([
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
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
  const client = mount(
    [() => answer()],
    new DispatchQueryClient({ defaultOptions: { queries: { retry: false } } })
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
  // A browser tells the readers on a timer, so they hear of the failure only once the queued
  // fetch has started and cleared it.
  const held = holdNotifications();
  try {
    await act(async () => asked.reject(answered(500)));
    expect(held.held()).toBeGreaterThan(0);
  } finally {
    held.tell();
  }
  expect(drawn.length).toBeGreaterThan(mark);
  expect(drawn.slice(mark)).not.toContain("none");
  expect(screen.getByRole("alert").textContent).toBe(`${LOAD}Retry`);

  await act(async () => queued.reject(answered(500)));
  await waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe("idle"));
  expect(drawn.slice(mark)).not.toContain("none");
  expect(screen.getByRole("alert").textContent).toBe(`${LOAD}Retry`);
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
  return fault === undefined ? null : <ReadFailure fault={fault} noun="the rows" />;
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
