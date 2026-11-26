// The rules of the browser tests' two modes, read by both configs and by `test.ts`. The local
// mode starts upstream's harness (`server.ts`); the deployed mode runs against a Dispatch that
// this run did not start. `PLAYWRIGHT_BASE_URL`, which upstream's `api.ts` also reads, selects it.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

import { PROJECT_KEY_PATTERN } from "../../contracts/src/dispatch-tools";
import { devSignInPath, sessionCookieName } from "../../dispatch/e2e/api";
import { stacksVariable } from "../../dispatch/e2e/harness-ports";

export const isDeployed = (env: NodeJS.ProcessEnv = process.env): boolean =>
  Boolean(env.PLAYWRIGHT_BASE_URL);

/**
 * The run's name, `E2E_RUN_NAME`. The config's first evaluation, in the runner, picks one when
 * the shell gives none, and each worker inherits it.
 */
export function nameRun(env: NodeJS.ProcessEnv = process.env): string {
  // A project key, so a test can name its project after the run.
  env.E2E_RUN_NAME ||= `E2E${randomBytes(4).readUInt32BE().toString(36).toUpperCase()}`;
  if (!PROJECT_KEY_PATTERN.test(env.E2E_RUN_NAME)) {
    throw new Error(
      `E2E_RUN_NAME is ${env.E2E_RUN_NAME}, not a project key (${PROJECT_KEY_PATTERN.source}).`
    );
  }
  return env.E2E_RUN_NAME;
}

/** The local mode's settings: none, and neither a deployed server nor, unless the run reuses
 *  servers it was given (`DISPATCH_E2E_REUSE_SERVERS=1`, which harness-up's exports set), a
 *  database. */
export function localSettings(env: NodeJS.ProcessEnv = process.env): void {
  if (isDeployed(env)) {
    throw new Error(
      "PLAYWRIGHT_BASE_URL is set, and the local mode starts its own Dispatch and empties its " +
        "database before each test. Run the deployed mode (`bun run test:browser:deployed`), or unset it."
    );
  }
  // Upstream's harness runs one stack on a given DATABASE_URL and empties it before each test.
  if (env.DATABASE_URL && env.DISPATCH_E2E_REUSE_SERVERS !== "1") {
    throw new Error(
      "DATABASE_URL is set, and upstream's harness would run on that database and empty it " +
        "before each test. Unset it to start a Postgres from DISPATCH_E2E_PG_IMAGE or " +
        "DISPATCH_E2E_PG_BIN, or source harness-up's exports to reuse the stack it started."
    );
  }
}

/** The files each phase of the deployed mode runs (`E2E_PHASE`). `routes-and-flows`, the
 *  default, leaves out the multiprocess specs and the axe run, which is local; the two switch
 *  phases run the switch file alone. No multiprocess file exists yet: the switch test adds the
 *  first, so the switch phases match no file until then. */
export type Phase = "routes-and-flows" | "switch-write" | "switch-read";

export const PHASES: Readonly<Record<Phase, { testMatch?: RegExp; testIgnore: RegExp[] }>> = {
  "routes-and-flows": {
    testIgnore: [/\.multiprocess\.e2e\.ts$/, /(^|\/)accessibility\.e2e\.ts$/],
  },
  "switch-write": { testMatch: /(^|\/)switch\.multiprocess\.e2e\.ts$/, testIgnore: [] },
  "switch-read": { testMatch: /(^|\/)switch\.multiprocess\.e2e\.ts$/, testIgnore: [] },
};

/** What the deployed mode reads from the operator's shell. */
export interface DeployedSettings {
  baseURL: string;
  /** A Playwright storage-state file whose cookies hold a session cookie for the server. */
  storageState: string;
  phase: Phase;
}

/** What names a database: the deployed mode never touches one. Upstream's psql helper reads the
 *  stacks manifest's `DATABASE_URL`. */
const DATABASE_VARIABLES = ["DATABASE_URL", stacksVariable] as const;

interface Cookie {
  name?: unknown;
  domain?: unknown;
  expires?: unknown;
}

/** Why the storage state signs nobody in at `baseURL`, or undefined when its session cookie does. */
function sessionCookieProblem(file: string, baseURL: string): string | undefined {
  let cookies: unknown;
  try {
    cookies = (JSON.parse(readFileSync(file, "utf8")) as { cookies?: unknown } | null)?.cookies;
  } catch (error) {
    return `E2E_STORAGE_STATE (${file}) is not a storage state: ${String(error)}`;
  }
  const host = new URL(baseURL).hostname;
  // A cookie's domain covers that host and, written with a leading dot, its subdomains.
  const covers = (domain: unknown) =>
    typeof domain === "string" &&
    (host === domain.replace(/^\./, "") || (domain.startsWith(".") && host.endsWith(domain)));
  const session = (Array.isArray(cookies) ? (cookies as Cookie[]) : []).find(
    (cookie) => cookie?.name === sessionCookieName && covers(cookie.domain)
  );
  if (session === undefined) {
    return `E2E_STORAGE_STATE (${file}) holds no ${sessionCookieName} cookie for ${host}.`;
  }
  if (
    typeof session.expires === "number" &&
    session.expires !== -1 &&
    session.expires * 1000 < Date.now()
  ) {
    return `E2E_STORAGE_STATE (${file}) holds a ${sessionCookieName} cookie that has expired.`;
  }
  return undefined;
}

/** The deployed mode's settings; throws, naming each problem, before any test runs. */
export function deployedSettings(env: NodeJS.ProcessEnv = process.env): DeployedSettings {
  const problems: string[] = [];
  for (const name of DATABASE_VARIABLES) {
    if (env[name]) {
      problems.push(`${name} is set: the deployed mode never touches a database. Unset it.`);
    }
  }
  for (const name of ["PLAYWRIGHT_BASE_URL", "E2E_AGENT_TOKEN", "E2E_STORAGE_STATE"]) {
    if (!env[name]) problems.push(`${name} is not set.`);
  }
  const phase = env.E2E_PHASE || "routes-and-flows";
  if (!(phase in PHASES)) {
    problems.push(`E2E_PHASE is ${phase}, not one of ${Object.keys(PHASES).join(", ")}.`);
  }
  const storageState = env.E2E_STORAGE_STATE ?? "";
  if (storageState !== "" && env.PLAYWRIGHT_BASE_URL) {
    const problem = sessionCookieProblem(storageState, env.PLAYWRIGHT_BASE_URL);
    if (problem !== undefined) problems.push(problem);
  }
  if (problems.length > 0) {
    throw new Error(`The deployed browser tests cannot start:\n${problems.join("\n")}`);
  }
  return { baseURL: env.PLAYWRIGHT_BASE_URL ?? "", phase: phase as Phase, storageState };
}

/** The sign-out path, which `test.ts` also aborts in the browser. */
export const SIGN_OUT = "/auth/logout";

const REFUSED: Readonly<Record<string, string>> = {
  [new URL(devSignInPath(""), "http://dispatch.invalid").pathname]:
    'The deployed mode refuses a seed as: "user", which signs in at dev sign-in. ' +
    'Seed as: "agent" (e2e/api.ts takes the token from E2E_AGENT_TOKEN).',
  [SIGN_OUT]:
    "The deployed mode refuses a sign-out, which would end every session of the signed-in person.",
};

/**
 * `send`, except that it refuses a request to dev sign-in or to sign-out. Upstream's `api.ts`
 * mints a user's cookie at dev sign-in for each seed `as: "user"`, its default, and a deployed
 * Dispatch has no dev sign-in: in the deployed mode a seed goes `as: "agent"` with
 * `E2E_AGENT_TOKEN`.
 */
export function refusingSignInAndOut(send: typeof fetch): typeof fetch {
  const guarded = (input: string | URL | Request, init?: RequestInit) => {
    const refused = REFUSED[new URL(input instanceof Request ? input.url : input).pathname];
    return refused === undefined ? send(input, init) : Promise.reject(new Error(refused));
  };
  return Object.assign(guarded, { preconnect: send.preconnect });
}
