// The rules of the browser tests' two modes, read by both configs and by `test.ts`. The local
// mode starts upstream's harness (`server.ts`); the deployed mode runs against a Dispatch that
// this run did not start. `PLAYWRIGHT_BASE_URL`, which upstream's `api.ts` also reads, selects it.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BrowserContext, Cookie as StorageCookie } from "@playwright/test";

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

/** The local mode's settings: no deployed server, and no database unless the run reuses servers
 *  it was given (`DISPATCH_E2E_REUSE_SERVERS=1`, which harness-up's exports set) or names a
 *  database it may empty (`E2E_LOCAL_DATABASE=throwaway`), such as a capped Postgres the operator
 *  started. */
export function localSettings(env: NodeJS.ProcessEnv = process.env): void {
  if (isDeployed(env)) {
    throw new Error(
      "PLAYWRIGHT_BASE_URL is set, and the local mode starts its own Dispatch and empties its " +
        "database before each test. Run the deployed mode (`bun run test:browser:deployed`), or unset it."
    );
  }
  // Empty is unset, as for every other setting here.
  const database = env.E2E_LOCAL_DATABASE || undefined;
  if (database !== undefined && database !== "throwaway") {
    throw new Error(`E2E_LOCAL_DATABASE is ${database}, and its one value is throwaway.`);
  }
  // Upstream's harness runs one stack on a given DATABASE_URL and empties it before each test.
  if (env.DATABASE_URL && env.DISPATCH_E2E_REUSE_SERVERS !== "1" && database === undefined) {
    throw new Error(
      "DATABASE_URL is set, and upstream's harness would run on that database and empty it " +
        "before each test. Unset it to start a Postgres from DISPATCH_E2E_PG_IMAGE or " +
        "DISPATCH_E2E_PG_BIN, source harness-up's exports to reuse the stack it started, or " +
        "set E2E_LOCAL_DATABASE=throwaway when that database may be emptied."
    );
  }
}

/** A spec that needs upstream's two-process mode, which is set for a whole run. */
const MULTIPROCESS = /\.multiprocess\.e2e\.ts$/;

/** The files the local config runs: in two-process mode (`bun run test:browser:switch`) the
 *  multiprocess specs alone, else every other spec, as upstream's config does. */
export function localFiles(processes: number): { testMatch: RegExp; testIgnore: RegExp[] } {
  return processes === 2
    ? { testMatch: MULTIPROCESS, testIgnore: [] }
    : { testMatch: /\.e2e\.ts$/, testIgnore: [MULTIPROCESS] };
}

/** The files each phase of the deployed mode runs (`E2E_PHASE`). `routes-and-flows`, the
 *  default, leaves out the multiprocess specs and the axe run, which is local; each switch phase
 *  runs the switch file alone, across a deploy to the app the phase names. */
export const SWITCH_PHASES = ["switch-to-upstream", "switch-to-new"] as const;
export type SwitchPhase = (typeof SWITCH_PHASES)[number];
export type Phase = "routes-and-flows" | SwitchPhase;

const isSwitchPhase = (phase: string): phase is SwitchPhase =>
  (SWITCH_PHASES as readonly string[]).includes(phase);

const SWITCH_FILE = { testMatch: /(^|\/)switch\.multiprocess\.e2e\.ts$/, testIgnore: [] };

export const PHASES: Readonly<Record<Phase, { testMatch?: RegExp; testIgnore: RegExp[] }>> = {
  "routes-and-flows": { testIgnore: [MULTIPROCESS, /(^|\/)accessibility\.e2e\.ts$/] },
  "switch-to-upstream": SWITCH_FILE,
  "switch-to-new": SWITCH_FILE,
};

/** What the deployed mode reads from the operator's shell. */
export type DeployedSettings = {
  baseURL: string;
  /** A Playwright storage-state file whose cookies hold a session cookie for the server. */
  storageState: string;
} & (
  | { phase: "routes-and-flows" }
  | {
      phase: SwitchPhase;
      /** The file the operator writes once the deploy has finished (`E2E_SWITCH_SIGNAL`). */
      switchSignal: string;
    }
);

/** What names a database: the deployed mode never touches one. Upstream's psql helper reads the
 *  stacks manifest's `DATABASE_URL`. */
const DATABASE_VARIABLES = ["DATABASE_URL", stacksVariable] as const;

/**
 * Why the storage state holds no session cookie, or undefined when it holds one. Whether the
 * cookie signs someone in at the server is the whoami test's to find.
 */
function sessionCookieProblem(file: string): string | undefined {
  let cookies: unknown;
  try {
    cookies = storageCookies(file);
  } catch (error) {
    return `E2E_STORAGE_STATE (${file}) is not a storage state: ${String(error)}`;
  }
  const named = (cookie: unknown) =>
    (cookie as { name?: unknown } | null)?.name === sessionCookieName;
  return Array.isArray(cookies) && cookies.some(named)
    ? undefined
    : `E2E_STORAGE_STATE (${file}) holds no ${sessionCookieName} cookie.`;
}

/** The cookies of the storage state `file`, which every deployed-mode context starts with. Its
 *  origins' storage is left out: a test starts from each app's default preferences, whatever the
 *  person's browser held. */
export function storageCookies(file: string): StorageCookie[] {
  return (
    (JSON.parse(readFileSync(file, "utf8")) as { cookies: StorageCookie[] } | null)?.cookies ?? []
  );
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
  if (storageState !== "") {
    const problem = sessionCookieProblem(storageState);
    if (problem !== undefined) problems.push(problem);
  }
  const switchSignal = env.E2E_SWITCH_SIGNAL || undefined;
  if (isSwitchPhase(phase) && switchSignal === undefined) {
    problems.push(
      `E2E_SWITCH_SIGNAL is not set: phase ${phase} waits for that file, which the operator ` +
        "writes once the deploy has finished."
    );
  }
  if (problems.length > 0) {
    throw new Error(`The deployed browser tests cannot start:\n${problems.join("\n")}`);
  }
  const common = { baseURL: env.PLAYWRIGHT_BASE_URL ?? "", storageState };
  return isSwitchPhase(phase) && switchSignal !== undefined
    ? { ...common, phase, switchSignal }
    : { ...common, phase: "routes-and-flows" };
}

/** The sign-out path, which the deployed mode also aborts in the browser. */
export const SIGN_OUT = "/auth/logout";

/** Aborts the browser's sign-out in `context`, as test.ts does in the contexts it gives. A
 *  deployed-mode test that makes a context of its own calls this on it. */
export async function abortSignOut(context: BrowserContext): Promise<void> {
  await context.route(`**${SIGN_OUT}`, (route) => route.abort());
}

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
