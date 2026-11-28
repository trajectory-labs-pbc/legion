import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { type DocumentRead, watchReadMarks } from "@/data/read-marks";
import { writesOf } from "@/upstream/writes";

import { visitOf, visitReadMarks } from "./visit";

const readOf = (artifactId: string, version: number): DocumentRead => ({
  artifact_id: artifactId,
  read_at: "2026-11-20T10:00:00Z",
  version,
});

test("the visit keeps the first read-mark answer, not upstream's later write", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["document-read", "a-first"], readOf("a-first", 3));
  const stop = watchReadMarks(queryClient, visitReadMarks);
  queryClient.setQueryData(["document-read", "a-first"], readOf("a-first", 5));
  stop();
  expect(visitOf("a-first").readMark?.answer).toEqual(readOf("a-first", 3));
});

test("an answer that is not a document read is not kept", () => {
  const queryClient = new QueryClient();
  const stop = watchReadMarks(queryClient, visitReadMarks);
  queryClient.setQueryData(["document-read", "a-odd"], { unexpected: true });
  queryClient.setQueryData(["document-read", "a-odd"], readOf("a-odd", 2));
  stop();
  expect(visitOf("a-odd").readMark?.answer).toEqual(readOf("a-odd", 2));
});

/** A client whose visits the aids record, with one document's read mark kept, then the host gone. */
function visited(artifactId: string): QueryClient {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["whoami"], { login: "alice" });
  queryClient.setQueryData(["document-read", artifactId], readOf(artifactId, 4));
  watchReadMarks(queryClient, visitReadMarks)();
  expect(visitOf(artifactId).readMark?.answer).toEqual(readOf(artifactId, 4));
  return queryClient;
}

test("a sign-out forgets every visit, after the host has gone too", () => {
  const queryClient = visited("a-out");
  writesOf(queryClient).signedOut("alice");
  expect(visitOf("a-out").readMark).toBeUndefined();
});

test("another person's sign-in forgets every visit; the same person's keeps them", () => {
  const queryClient = visited("a-next");
  queryClient.setQueryData(["whoami"], { login: "alice" });
  expect(visitOf("a-next").readMark?.answer).toEqual(readOf("a-next", 4));
  queryClient.setQueryData(["whoami"], { login: "bob" });
  expect(visitOf("a-next").readMark).toBeUndefined();
});
