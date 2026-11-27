// The reader's read marks of documents, as upstream's read of each answers, and when the person
// goes: the reading aids keep each document's first answer for the visit.
import { type Query, type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { DocumentRead } from "@/upstream/contract";
import { writesOf } from "@/upstream/writes";

import { onAnotherPerson } from "./session";

export type { DocumentRead } from "@/upstream/contract";

/** The name of upstream's read of the reader's read mark of a document. */
const READ_MARK = "document-read";

/** The key of upstream's read of the reader's read mark of a document. */
export const readMarkKey = (artifactId: string) => [READ_MARK, artifactId];

/** What a reader of the read marks does with them. */
export interface ReadMarkListener {
  /** A settled answer of upstream's read of the reader's read mark of the document `artifactId`. */
  readonly answer: (artifactId: string, answer: DocumentRead) => void;
  /** The person went: a sign-out upstream tells of, or another person signed in after a lapse. */
  readonly leave: () => void;
}

const isDocumentRead = (answer: unknown): answer is DocumentRead =>
  typeof answer === "object" && answer !== null && "version" in answer && "artifact_id" in answer;

function recordReadMark(query: Query, listener: ReadMarkListener): void {
  const [name, artifactId] = query.queryKey;
  if (name !== READ_MARK || typeof artifactId !== "string") return;
  const answer: unknown = query.state.data;
  if (query.state.status !== "success" || !isDocumentRead(answer)) return;
  listener.answer(artifactId, answer);
}

/** The `leave` callbacks of each client's listeners. */
const leaves = new WeakMap<QueryClient, Set<() => void>>();

/** Tells `leave` when the person goes, for as long as the page lives: at each sign-out upstream
 *  tells of, and when another person signs in after a lapse. */
function leaveWhenThePersonGoes(queryClient: QueryClient, leave: () => void): void {
  let callbacks = leaves.get(queryClient);
  if (callbacks === undefined) {
    const each = new Set<() => void>();
    const tell = () => {
      for (const callback of each) callback();
    };
    writesOf(queryClient).onSignedOut(tell);
    onAnotherPerson(queryClient, tell);
    leaves.set(queryClient, each);
    callbacks = each;
  }
  callbacks.add(leave);
}

/** Gives `listener` each read-mark answer of `queryClient`'s cache, until the returned stop. */
export function watchReadMarks(queryClient: QueryClient, listener: ReadMarkListener): () => void {
  leaveWhenThePersonGoes(queryClient, listener.leave);
  const cache = queryClient.getQueryCache();
  for (const query of cache.getAll()) recordReadMark(query, listener);
  return cache.subscribe((event) => {
    if (event.type === "updated") recordReadMark(event.query, listener);
  });
}

/** Gives `listener` each read-mark answer of the app's cache while the caller is mounted. */
export function useReadMarks(listener: ReadMarkListener): void {
  const queryClient = useQueryClient();
  useEffect(() => watchReadMarks(queryClient, listener), [queryClient, listener]);
}
