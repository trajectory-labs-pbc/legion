import type { QueryClient } from "@tanstack/react-query";
import { waitFor as waitForExpectation } from "@testing-library/react";
import { http } from "msw";
import { ApiError } from "@/upstream/api";
import { answerRequests } from "./upstream";

/**
 * Keeps each of these reads pending for the rest of the test. A request to any other route is
 * answered by upstream's shell answers, or fails the test (bunfig.toml).
 */
export function holdReads(...paths: string[]): void {
  answerReads(paths, () => undefined);
}

/** A shell read's response, now or later, or none to leave it pending. */
export type ShellAnswer = Response | Promise<Response> | undefined;

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
 * Answers the reads at `paths` by address for the rest of the test: `answer` gives a read its
 * response, now or later, and a read it leaves out stays pending. `asked` lists each read as it
 * arrives. A request to any other route is still upstream's to answer, or fails the test.
 */
export function answerReads(
  paths: readonly string[],
  answer: (url: string) => ShellAnswer
): { asked: string[] } {
  const asked: string[] = [];
  answerRequests(
    ...paths.map((path) =>
      http.get(path, ({ request }) => {
        asked.push(request.url);
        return answer(request.url) ?? new Promise<Response>(() => {});
      })
    )
  );
  return { asked };
}

/** `answerReads` for the reads of the shell's header and sidebar. */
export const answerShellReads = (answer: (url: string) => ShellAnswer) =>
  answerReads(SHELL_READS, answer);

export const json = (body: unknown, status = 200) => Response.json(body, { status });

/** The server's code for a failure answered with `status`. */
const codeOf = (status: number) =>
  status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "INTERNAL";

/** The server's refusal of a read that failed on its side. */
export const readFailed = () => json({ code: codeOf(500), error: "internal server error" }, 500);

/** The server's refusal of a read: a 403, or a 404 of a record it does not have. */
export const readRefused = (status: 403 | 404) =>
  json({ code: codeOf(status), error: "no" }, status);

/** The server's refusal of the credential requests read while the secrets broker is down. */
export const brokerUnreachable = () =>
  json({ code: "AGENT_SECRETS_UNAVAILABLE", error: "the secrets broker is unreachable" }, 503);

/** Waits until `done` holds, on upstream's budget, and fails the test when it never does. */
export const waitFor = (done: () => boolean) =>
  waitForExpectation(() => {
    if (!done()) throw new Error("the awaited state never came");
  });

/** Whether a read `client` holds was last answered with `status`. */
export const refusalLanded = (client: QueryClient, status: number) =>
  client
    .getQueryCache()
    .getAll()
    .some((query) => query.state.error instanceof ApiError && query.state.error.status === status);

/** The client's error for a read the server answered with `status`, `error` its words and `code`. */
export const answered = (status: number, error = "no", code = codeOf(status)) =>
  new ApiError(status, { code, error });
