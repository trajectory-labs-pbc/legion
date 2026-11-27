import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { writesOf } from "@/upstream/writes";

import { type ReadMarkListener, watchReadMarks } from "./read-marks";

/** A listener that counts the times it heard the person go. */
function counting(): ReadMarkListener & { left: number } {
  const listener = { left: 0, answer: () => {}, leave: () => void listener.left++ };
  return listener;
}

test("each listener of one client hears the person go, after its watch stopped too", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["whoami"], { login: "alice" });
  const first = counting();
  const second = counting();
  watchReadMarks(queryClient, first)();
  watchReadMarks(queryClient, second)();
  writesOf(queryClient).signedOut("alice");
  expect([first.left, second.left]).toEqual([1, 1]);
  queryClient.setQueryData(["whoami"], { login: "bob" });
  expect([first.left, second.left]).toEqual([2, 2]);
});
