import { afterEach, expect, test } from "bun:test";
import {
  keepPreviousData,
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
  ApiError,
  DispatchQueryClient,
  NetworkError,
  NO_ROUTE_ROLLING_RELEASE_MESSAGE,
  RequestTimeoutError,
} from "@/upstream/api";
import { sleep } from "../../tests/react";
import { holdNotifications } from "../../tests/upstream";
import { ReadFailure, refreshFailureOf, useReadFailure } from "./read-failure";

afterEach(() => {
  onlineManager.setOnline(true);
  cleanup();
});

const answered = (status: number, error = "no") =>
  new ApiError(status, { code: status === 404 ? "NOT_FOUND" : "X", error });

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

/** One read of `version`, which shows the last answer while another version is read. */
function Picked({
  answer,
  version,
}: {
  answer: (version: number) => Promise<unknown>;
  version: number;
}) {
  const read = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => answer(version),
    queryKey: ["picked", version],
  });
  const fault = useReadFailure(read);
  return (
    <>
      <p data-testid="fetching">{read.fetchStatus}</p>
      {fault === undefined ? null : <ReadFailure fault={fault} noun="the rows" />}
    </>
  );
}

/** Mounts `Picked`; `show` changes the version it reads. */
function mountPicked(answer: (version: number) => Promise<unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const at = (version: number) => (
    <QueryClientProvider client={client}>
      <Picked answer={answer} version={version} />
    </QueryClientProvider>
  );
  const view = render(at(1));
  return { client, show: (version: number) => view.rerender(at(version)) };
}

/** Waits until the read's fetch status is `status`. */
const fetchStatus = (status: "fetching" | "idle") =>
  waitFor(() => expect(screen.getByTestId("fetching").textContent).toBe(status));

test("read-failure: another read at the same place does not take the last read's refusal", async () => {
  const again = Promise.withResolvers<never>();
  const answers = new Map<number, () => Promise<unknown>>([
    [1, () => Promise.resolve("one")],
    [2, () => Promise.reject(answered(500))],
    [3, () => Promise.reject(answered(403))],
  ]);
  const { show } = mountPicked((version) => answers.get(version)?.() ?? Promise.resolve(null));
  await fetchStatus("idle");
  show(2);
  expect((await screen.findByRole("alert")).textContent).toBe(`${LOAD}Retry`);
  // The clock moves on, so that two errors never share a millisecond.
  await sleep(2);
  show(3);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("You cannot see the rows.")
  );
  answers.set(2, () => again.promise);
  show(2);
  await fetchStatus("fetching");
  // This place last saw the 403, which is newer than the 500 it saw here before.
  expect(screen.queryByRole("alert")).toBeNull();
  await act(async () => again.reject(answered(500)));
  await fetchStatus("idle");
  expect(screen.getByRole("alert").textContent).toBe(`${LOAD}Retry`);
});

test("read-failure: a failed read asked again over the last answer keeps its failure", async () => {
  const again = Promise.withResolvers<never>();
  let answer = (version: number) =>
    version === 1 ? Promise.resolve("one") : Promise.reject(answered(500));
  const { show } = mountPicked((version) => answer(version));
  await fetchStatus("idle");
  show(2);
  const button = await screen.findByRole("button", { name: "Retry" });
  answer = () => again.promise;
  await userEvent.click(button);
  await fetchStatus("fetching");
  const retry = screen.getByRole("button", { name: "Retry" });
  expect(retry.hasAttribute("data-loading")).toBe(true);
  await act(async () => again.reject(answered(500)));
  await fetchStatus("idle");
  expect(screen.getByRole("alert").textContent).toBe(`${LOAD}Retry`);
});

test("read-failure: a refused read asked again over the last answer keeps its refusal", async () => {
  const again = Promise.withResolvers<never>();
  let answer = (version: number) =>
    version === 1 ? Promise.resolve("one") : Promise.reject(answered(403));
  const { client, show } = mountPicked((version) => answer(version));
  await fetchStatus("idle");
  show(2);
  expect((await screen.findByRole("alert")).textContent).toBe("You cannot see the rows.");
  answer = () => again.promise;
  await act(async () => {
    void client.refetchQueries({ queryKey: ["picked", 2] });
  });
  await fetchStatus("fetching");
  expect(screen.getByRole("alert").textContent).toBe("You cannot see the rows.");
  await act(async () => again.reject(answered(403)));
  await fetchStatus("idle");
  expect(screen.getByRole("alert").textContent).toBe("You cannot see the rows.");
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
