import { afterEach, expect, test } from "bun:test";
import type { UseQueryResult } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { ApiError } from "@upstream-dispatch/api/client";

import { ReadFailure, readFailureOf } from "./read-failure";

afterEach(cleanup);

/** A read whose first answer failed with `error`. */
const failed = (error: Error) =>
  ({
    data: undefined,
    error,
    errorUpdateCount: 1,
    isFetching: false,
    refetch: () => Promise.resolve(),
  }) as unknown as UseQueryResult<unknown>;

const drawn = (...errors: Error[]) => {
  const fault = readFailureOf(...errors.map(failed));
  if (fault === undefined) throw new Error("no failure");
  render(<ReadFailure fault={fault} noun="the rows" />);
};

test("read-failure: a 403 says the reader has no access, with no Retry", () => {
  drawn(new ApiError(403, { code: "FORBIDDEN", error: "no" }));
  expect(screen.getByText("You cannot see the rows.")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
});

test("read-failure: a 404 says the record was not found, with no Retry", () => {
  drawn(new ApiError(404, { code: "NOT_FOUND", error: "gone" }));
  expect(screen.getByText("Could not find the rows.")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
});

test("read-failure: a 500 says it could not load, with Retry", () => {
  drawn(new ApiError(500, { code: "INTERNAL", error: "broke" }));
  expect(screen.getByText("Could not load the rows.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
});

test("read-failure: a 500 beside a 404 keeps Retry, as trying again can clear the 500", () => {
  drawn(
    new ApiError(500, { code: "INTERNAL", error: "broke" }),
    new ApiError(404, { code: "NOT_FOUND", error: "gone" })
  );
  expect(screen.getByText("Could not load the rows.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
});
