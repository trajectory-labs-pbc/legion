import type { Query, QueryClient } from "@tanstack/react-query";
import type { DocumentRead } from "@upstream-dispatch/api/types";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";

/** What the aids keep of one document for the visit: from its first show in this tab to a reload. */
export interface Visit {
  /** The first answer of upstream's read-mark read in the visit, before upstream's write moves it. */
  readMark?: { readonly answer: DocumentRead };
}

const visits = new Map<string, Visit>();

/** The visit of the document `artifactId`, made at its first call. */
export function visitOf(artifactId: string): Visit {
  let visit = visits.get(artifactId);
  if (visit === undefined) {
    visit = {};
    visits.set(artifactId, visit);
  }
  return visit;
}

const isDocumentRead = (answer: unknown): answer is DocumentRead =>
  typeof answer === "object" && answer !== null && "version" in answer && "artifact_id" in answer;

function recordReadMark(query: Query): void {
  const [name, artifactId] = query.queryKey;
  if (name !== "document-read" || typeof artifactId !== "string") return;
  const answer: unknown = query.state.data;
  if (query.state.status !== "success" || !isDocumentRead(answer)) return;
  visitOf(artifactId).readMark ??= { answer };
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
  writesOf(queryClient).onSignedOut(() => visits.clear());
  let person = loginIn(queryClient.getQueryData(["whoami"]));
  queryClient.getQueryCache().subscribe(({ query }) => {
    if (query.queryKey[0] !== "whoami") return;
    const login = loginIn(query.state.data);
    if (login === undefined || login === person) return;
    if (person !== undefined) visits.clear();
    person = login;
  });
}

/** Records each document's first read-mark answer in its visit, until the returned stop. */
export function recordReadMarks(queryClient: QueryClient): () => void {
  forgetOnSignOut(queryClient);
  const cache = queryClient.getQueryCache();
  for (const query of cache.getAll()) recordReadMark(query);
  return cache.subscribe((event) => recordReadMark(event.query));
}
