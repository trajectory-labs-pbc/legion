// `bun run test:browser:deployed-local`: the deployed mode against a local server, as CI runs it
// after the local mode. It starts one stack the way the local mode's global setup does: upstream's
// harness-pool.ts, whose Postgres comes from DISPATCH_E2E_PG_IMAGE or DISPATCH_E2E_PG_BIN
// (harness-postgres.ts) and whose server is run-server.sh on this app's build. It prints the
// server's URL, signs a person in at the stack's dev sign-in for the storage state, mints that
// person an agent token with no scope, runs `test:browser:deployed` against the stack with both,
// and stops the stack. The stack's DATABASE_URL goes to the stack's own processes, never to this
// process's environment or the test run's. Arguments go to Playwright.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { baseUrlOf, devSignInPath, sessionCookieFrom } from "../../dispatch/e2e/api";
import { startStacks, stopStacks } from "../../dispatch/e2e/harness-pool";
import { serveDist } from "./server";

const LOGIN = "alice";

async function answer(response: Response, what: string): Promise<Response> {
  if (!response.ok) throw new Error(`${what}: ${response.status} ${await response.text()}`);
  return response;
}

/** The storage state and the agent token of `LOGIN` at `base`. */
async function credentials(base: string, dir: string): Promise<{ state: string; token: string }> {
  const signIn = await fetch(new URL(devSignInPath(LOGIN), base), { redirect: "manual" });
  const cookie = sessionCookieFrom(signIn);
  if (cookie === undefined) {
    throw new Error(`dev sign-in as ${LOGIN}: ${signIn.status}, and no session cookie`);
  }
  const minted = await answer(
    await fetch(new URL("/api/v1/me/agent-tokens", base), {
      body: JSON.stringify({ name: "deployed-mode run", scopes: [] }),
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: new URL(base).origin },
      method: "POST",
    }),
    "minting an agent token"
  );
  const { token } = (await minted.json()) as { token: string };
  const equals = cookie.indexOf("=");
  const state = join(dir, "state.json");
  const session = {
    domain: new URL(base).hostname,
    expires: -1,
    httpOnly: true,
    name: cookie.slice(0, equals),
    path: "/",
    sameSite: "Strict",
    secure: false,
    value: cookie.slice(equals + 1),
  };
  writeFileSync(state, JSON.stringify({ cookies: [session], origins: [] }), { mode: 0o600 });
  return { state, token };
}

function run(env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = ["run", "test:browser:deployed", ...process.argv.slice(2)];
    const child = spawn("bun", args, { env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

serveDist("tl-dispatch");
// Without the shell's DATABASE_URL, the pool starts a Postgres of its own rather than use and
// empty that database.
const { DATABASE_URL: _shellDatabase, ...shell } = process.env;
const [stack] = await startStacks(1, { env: shell });
const dir = mkdtempSync(join(tmpdir(), "tl-dispatch-deployed-"));
let status = 1;
try {
  const base = baseUrlOf({ ...stack.env });
  console.error(`e2e/local-stack.ts: the server is at ${base}`);
  const { state, token } = await credentials(base, dir);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2E_AGENT_TOKEN: token,
    E2E_STORAGE_STATE: state,
    PLAYWRIGHT_BASE_URL: base,
  };
  // The deployed mode refuses a named database.
  for (const name of ["DATABASE_URL", "DISPATCH_E2E_STACKS", "DISPATCH_E2E_REUSE_SERVERS"]) {
    delete env[name];
  }
  status = await run(env);
} finally {
  rmSync(dir, { force: true, recursive: true });
  await stopStacks(status !== 0);
}
process.exit(status);
