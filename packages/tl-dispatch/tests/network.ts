import { waitFor as waitForExpectation } from "@testing-library/react";
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
