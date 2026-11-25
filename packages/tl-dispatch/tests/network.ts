import { answerRequests } from "@upstream-dispatch/__tests__/network";
import { http } from "msw";

/**
 * Keeps each of these reads pending for the rest of the test. A request to any other route is
 * answered by upstream's shell answers, or fails the test (bunfig.toml).
 */
export function holdReads(...paths: string[]): void {
  answerRequests(...paths.map((path) => http.get(path, () => new Promise<Response>(() => {}))));
}

/** Keeps the reads of the shell's header and sidebar pending: they draw what needs no read. */
export function holdShellReads(): void {
  holdReads(
    "/auth/whoami",
    "/api/v1/inbox",
    "/api/v1/issues",
    "/api/v1/credential-requests",
    "/api/v1/me/agents/state",
    "/api/v1/priorities",
    "/api/v1/projects"
  );
}
