import type { ErrorBody } from "@legion/contracts";
import { waitFor as waitForExpectation } from "@testing-library/react";
import type { Body, Op, PathParams, PathsOf, Result } from "@upstream-dispatch/api/paths";
import { http } from "msw";
import { answerRequests } from "./upstream";

/**
 * Keeps each of these reads pending for the rest of the test. A request to any other route is
 * answered by upstream's shell answers, or fails the test (bunfig.toml).
 */
export function holdReads(...paths: string[]): void {
  answerRequests(...paths.map((path) => http.get(path, () => new Promise<Response>(() => {}))));
}

/** The reads the shell's header and sidebar make. */
const SHELL_READS = [
  "/auth/whoami",
  "/api/v1/agents",
  "/api/v1/inbox",
  "/api/v1/issues",
  "/api/v1/credential-requests",
  "/api/v1/me/agents/state",
  "/api/v1/me/replies",
  "/api/v1/priorities",
  "/api/v1/projects",
];

/** Keeps the reads of the shell's header and sidebar pending: they draw what needs no read. */
export function holdShellReads(): void {
  holdReads(...SHELL_READS);
}

/**
 * Answers the shell's reads by address for the rest of the test: `answer` gives a read its
 * response, and a read it leaves out stays pending. `asked` lists each read as it arrives. A
 * request to any other route is still upstream's to answer, or fails the test.
 */
export function answerShellReads(answer: (url: string) => Response | undefined): {
  asked: string[];
} {
  const asked: string[] = [];
  answerRequests(
    ...SHELL_READS.map((path) =>
      http.get(path, ({ request }) => {
        asked.push(request.url);
        return answer(request.url) ?? new Promise<Response>(() => {});
      })
    )
  );
  return { asked };
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Waits until `done` holds, on upstream's budget, and fails the test when it never does. */
export const waitFor = (done: () => boolean) =>
  waitForExpectation(() => {
    if (!done()) throw new Error("the awaited state never came");
  });

/** A refusal as Dispatch writes one: its status and its `{code, error}` body. */
export type Refusal = ErrorBody & { readonly status: number };

/** How a request ends: with its answer's body, or with a refusal. */
export type Settled<T> = { readonly answer: T } | { readonly refusal: Refusal };

/** Holds each request it takes until `release` says how they all end. */
export interface Hold<T> {
  readonly held: Promise<Settled<T>>;
  readonly release: (settled: Settled<T>) => void;
}

/** What a route's handler does with each request: answer it, refuse it, or hold it. */
export type Reply<T> = Settled<T> | Hold<T>;

export function hold<T>(): Hold<T> {
  let release: (settled: Settled<T>) => void = () => {};
  const held = new Promise<Settled<T>>((resolve) => {
    release = resolve;
  });
  return { held, release };
}

/** One request a handler took: its address, and its JSON body (undefined when it has none). */
export interface Sent<B> {
  readonly url: string;
  readonly body: B;
}

type Method = "get" | "post" | "put" | "delete";

/** How a test may end a request of one kind: with `answer`, or with `refusal`. */
export interface Endings<T> {
  readonly answer: T;
  readonly refusal: Refusal;
}

export const refused = ({ refusal }: { readonly refusal: Refusal }): Settled<never> => ({
  refusal,
});

/** A route of upstream's generated contract, with an answer and a refusal that Dispatch gives. */
export interface Route<M extends Method, P extends PathsOf<M>> extends Endings<Result<P, M>> {
  readonly method: M;
  readonly path: P;
}

/** Any route, so that one call takes each route of a list. */
interface AnyRoute extends Endings<unknown> {
  readonly method: Method;
  readonly path: string;
}

/** The request body that the contract gives a route. */
type BodyOf<R> = R extends { readonly method: infer M extends Method; readonly path: infer P }
  ? P extends PathsOf<M>
    ? Body<P, M>
    : never
  : never;

/** The names of a route's path parameters. */
type ParamsOf<R> = R extends { readonly method: infer M extends Method; readonly path: infer P }
  ? P extends PathsOf<M>
    ? keyof PathParams<Op<P, M>>
    : never
  : never;

export const route = <M extends Method, P extends PathsOf<M>>(
  method: M,
  path: P,
  endings: Endings<Result<P, M>>
): Route<M, P> => ({ ...endings, method, path });

function respond<T>(settled: Settled<T>): Response {
  if ("refusal" in settled) {
    const { status, ...body } = settled.refusal;
    return json(body, status);
  }
  return settled.answer === undefined ? new Response(null, { status: 204 }) : json(settled.answer);
}

/**
 * Gives each `method` request to `path` (an MSW path) `reply` for the rest of the test, and lists
 * each request it takes. A later handler for the same request takes it over.
 */
export function answerPath<T, B>(method: Method, path: string, reply: Reply<T>): Sent<B>[] {
  const sent: Sent<B>[] = [];
  answerRequests(
    http[method](path, async ({ request }) => {
      const text = await request.text();
      sent.push({ body: (text === "" ? undefined : JSON.parse(text)) as B, url: request.url });
      return respond("held" in reply ? await reply.held : reply);
    })
  );
  return sent;
}

/**
 * Gives each request on `route` `reply` (by default the route's answer), typed by the route's
 * answer and body in the contract. `params` narrows the handler to the requests that name those
 * path values: one ask of a bulk snooze, for example.
 */
export function answerRoute<R extends AnyRoute>(
  { answer, method, path }: R,
  reply: Reply<R["answer"]> = { answer },
  params: Partial<Record<ParamsOf<R>, string>> = {}
): Sent<BodyOf<R>>[] {
  const values = new Map<string, string | undefined>(Object.entries(params));
  const pattern = path.replace(/\{([^}]+)\}/gu, (_whole, name: string) => {
    const value = values.get(name);
    return value === undefined ? `:${name}` : encodeURIComponent(value);
  });
  return answerPath(method, pattern, reply);
}
