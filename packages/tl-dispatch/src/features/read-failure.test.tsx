import { afterEach, expect, test } from "bun:test";
import { NO_ROUTE_ROLLING_RELEASE_MESSAGE } from "@legion/contracts";
import { QueryClient, QueryClientProvider, useQueries } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, NetworkError, RequestTimeoutError } from "@upstream-dispatch/api/client";

import { ReadFailure, readRetry, useReadFailure } from "./read-failure";

afterEach(cleanup);

const answered = (status: number, error = "no") =>
  new ApiError(status, { code: status === 404 ? "NOT_FOUND" : "X", error });
const NO_ROUTE = "no route for GET /api/v1/rows";

/** Reads that each ask `answers[i]`, and the failure they make together. */
function Failure({ answers }: { answers: readonly (() => Promise<unknown>)[] }) {
  const reads = useQueries({
    queries: answers.map((answer, index) => ({ queryKey: ["read", index], queryFn: answer })),
  });
  const fault = useReadFailure(...reads);
  return (
    <>
      <p data-testid="fetching">{reads.map((read) => read.fetchStatus).join(" ")}</p>
      {fault === undefined ? null : <ReadFailure fault={fault} noun="the rows" />}
    </>
  );
}

function mount(answers: readonly (() => Promise<unknown>)[]): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

test("read-failure: Retry on a 500 beside a 403 asks both reads again", async () => {
  const asked = [0, 0];
  mount([
    () => {
      asked[0] = (asked[0] ?? 0) + 1;
      return Promise.reject(answered(500));
    },
    () => {
      asked[1] = (asked[1] ?? 0) + 1;
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
