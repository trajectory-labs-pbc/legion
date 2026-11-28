import type { Query, QueryClient } from "@tanstack/react-query";
import type { DocumentRead } from "@upstream-dispatch/api/types";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import { useSyncExternalStore } from "react";

import type { BaselineChoice } from "./baseline";

/** What the aids keep of one document for the visit: from its first show in this tab to a reload. */
export interface Visit {
  /** The first answer of upstream's read-mark read in the visit, before upstream's write moves it. */
  readonly readMark?: { readonly answer: DocumentRead };
  /** The baseline the first settled answers fixed; null when they found none. */
  baseline?: BaselineChoice | null;
  /** The version the reader picked under "Compare with". */
  readonly compareWith?: number;
  /** The reader's fold choices, the `?q=` term last applied, and the blocks the first comparison touched. */
  readonly blockFolds: {
    readonly choices: Map<string, boolean>;
    term?: string;
    touched?: ReadonlySet<string>;
  };
}

/** The name of upstream's read of the reader's read mark of a document. */
export const READ_MARK = "document-read";

const visits = new Map<string, Visit>();
const listeners = new Set<() => void>();
const forgetListeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** The visit of the document `artifactId`, made at its first call. */
export function visitOf(artifactId: string): Visit {
  let visit = visits.get(artifactId);
  if (visit === undefined) {
    visit = { blockFolds: { choices: new Map() } };
    visits.set(artifactId, visit);
  }
  return visit;
}

/** The visit of `artifactId`, drawn again at each change of it. */
export const useVisit = (artifactId: string): Visit =>
  useSyncExternalStore(subscribe, () => visitOf(artifactId));

/** Runs `listener` each time the visits are forgotten. */
export function onForget(listener: () => void): void {
  forgetListeners.add(listener);
}

function update(artifactId: string, change: Partial<Visit>): void {
  visits.set(artifactId, { ...visitOf(artifactId), ...change });
  notify();
}

function forget(): void {
  visits.clear();
  for (const listener of forgetListeners) listener();
  notify();
}

/** Keeps the reader's "Compare with" pick of the document for the visit. */
export const chooseVersion = (artifactId: string, version: number) =>
  update(artifactId, { compareWith: version });

/** The visit's baseline: `choice` when none is fixed yet, which then stays for the visit. */
export function fixBaseline(artifactId: string, choice: BaselineChoice | null) {
  const visit = visitOf(artifactId);
  // Set in place while drawing, as a lazy ref is: every reader would fix the same choice.
  if (visit.baseline === undefined) visit.baseline = choice;
  return visit.baseline;
}

const isDocumentRead = (answer: unknown): answer is DocumentRead =>
  typeof answer === "object" && answer !== null && "version" in answer && "artifact_id" in answer;

function recordReadMark(query: Query): void {
  const [name, artifactId] = query.queryKey;
  if (name !== READ_MARK || typeof artifactId !== "string") return;
  const answer: unknown = query.state.data;
  if (query.state.status !== "success" || !isDocumentRead(answer)) return;
  if (visitOf(artifactId).readMark === undefined) update(artifactId, { readMark: { answer } });
}

/** The login a whoami answer names. */
const loginIn = (answer: unknown): string | undefined =>
  typeof answer === "object" &&
  answer !== null &&
  "login" in answer &&
  typeof answer.login === "string"
    ? answer.login
    : undefined;

const forgetful = new WeakSet<QueryClient>();

/** Forgets every visit when the person goes, for as long as the page lives: at each sign-out
 *  upstream tells of, and when another person signs in after a lapse. */
function forgetOnSignOut(queryClient: QueryClient): void {
  if (forgetful.has(queryClient)) return;
  forgetful.add(queryClient);
  writesOf(queryClient).onSignedOut(forget);
  let person = loginIn(queryClient.getQueryData(["whoami"]));
  queryClient.getQueryCache().subscribe(({ query }) => {
    if (query.queryKey[0] !== "whoami") return;
    const login = loginIn(query.state.data);
    if (login === undefined || login === person) return;
    if (person !== undefined) forget();
    person = login;
  });
}

/** Records each document's first read-mark answer in its visit, until the returned stop. */
export function recordReadMarks(queryClient: QueryClient): () => void {
  forgetOnSignOut(queryClient);
  const cache = queryClient.getQueryCache();
  for (const query of cache.getAll()) recordReadMark(query);
  return cache.subscribe((event) => {
    if (event.type === "updated") recordReadMark(event.query);
  });
}
