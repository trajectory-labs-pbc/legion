import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { temporaryDirectory } from "../../test-fixtures/src/temporary-directories";
import {
  deployedSettings,
  localSettings,
  nameRun,
  PHASES,
  type Phase,
  refusingSignInAndOut,
} from "./modes";

const directory = temporaryDirectory("tl-dispatch-e2e");
let files = 0;

function stateFile(cookies: readonly object[] | string): string {
  files += 1;
  const file = join(directory, `state-${files}.json`);
  writeFileSync(
    file,
    typeof cookies === "string" ? cookies : JSON.stringify({ cookies, origins: [] })
  );
  return file;
}

const session = { name: "dsession", domain: "dispatch.example", expires: -1 };

const deployedEnv = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  PLAYWRIGHT_BASE_URL: "https://dispatch.example",
  E2E_AGENT_TOKEN: "token",
  E2E_STORAGE_STATE: stateFile([session]),
  ...extra,
});

describe("the deployed mode", () => {
  test("starts with its three settings and a session cookie", () => {
    const env = deployedEnv();
    expect(deployedSettings(env)).toEqual({
      baseURL: "https://dispatch.example",
      phase: "routes-and-flows",
      storageState: env.E2E_STORAGE_STATE ?? "",
    });
  });

  test("runs the files of its phase", () => {
    const runs = (phase: Phase, file: string) => {
      const { testIgnore, testMatch = /\.e2e\.ts$/ } = PHASES[phase];
      return testMatch.test(file) && !testIgnore.some((pattern) => pattern.test(file));
    };
    const files = [
      "e2e/routes.e2e.ts",
      "e2e/accessibility.e2e.ts",
      "e2e/switch.multiprocess.e2e.ts",
    ];
    expect(files.filter((file) => runs("routes-and-flows", file))).toEqual(["e2e/routes.e2e.ts"]);
    for (const phase of ["switch-write", "switch-read"] as const) {
      expect(files.filter((file) => runs(phase, file))).toEqual(["e2e/switch.multiprocess.e2e.ts"]);
    }
    expect(deployedSettings(deployedEnv({ E2E_PHASE: "switch-read" })).phase).toBe("switch-read");
    expect(() => deployedSettings(deployedEnv({ E2E_PHASE: "switch" }))).toThrow(
      "E2E_PHASE is switch, not one of routes-and-flows, switch-write, switch-read."
    );
  });

  test("refuses to start while a database is named", () => {
    const start = () =>
      deployedSettings(
        deployedEnv({
          DATABASE_URL: "postgres://x",
          DISPATCH_E2E_STACKS: "[]",
        })
      );
    expect(start).toThrow("DATABASE_URL is set: the deployed mode never touches a database");
    expect(start).toThrow("DISPATCH_E2E_STACKS is set");
  });

  test("names each setting it misses", () => {
    const start = () => deployedSettings({});
    for (const name of ["PLAYWRIGHT_BASE_URL", "E2E_AGENT_TOKEN", "E2E_STORAGE_STATE"]) {
      expect(start).toThrow(`${name} is not set.`);
    }
  });

  test("refuses a storage state that signs nobody in at the server", () => {
    const start = (state: string) => () =>
      deployedSettings(deployedEnv({ E2E_STORAGE_STATE: state }));
    expect(start(stateFile([{ ...session, name: "other" }]))).toThrow(
      "holds no dsession cookie for dispatch.example"
    );
    expect(start(stateFile([{ ...session, domain: "other.example" }]))).toThrow(
      "holds no dsession cookie for dispatch.example"
    );
    expect(start(stateFile([{ ...session, expires: 1 }]))).toThrow("has expired");
    expect(start(stateFile("{"))).toThrow("is not a storage state");
  });

  test("takes a session cookie of a parent domain", () => {
    const env = deployedEnv({ E2E_STORAGE_STATE: stateFile([{ ...session, domain: ".example" }]) });
    expect(() => deployedSettings(env)).not.toThrow();
  });

  test("refuses a dev sign-in and a sign-out, and sends every other request", async () => {
    const sent: string[] = [];
    const send = Object.assign(
      async (input: string | URL | Request) => {
        sent.push(String(input));
        return new Response("{}");
      },
      { preconnect: () => {} }
    );
    const guarded = refusingSignInAndOut(send);
    await expect(guarded("https://dispatch.example/auth/_dev/signin?login=alice")).rejects.toThrow(
      'refuses a seed as: "user"'
    );
    await expect(
      guarded(new Request("https://dispatch.example/auth/logout", { method: "POST" }))
    ).rejects.toThrow("refuses a sign-out");
    await guarded("https://dispatch.example/api/v1/projects");
    expect(sent).toEqual(["https://dispatch.example/api/v1/projects"]);
  });
});

describe("the local mode", () => {
  test("refuses a deployed server", () => {
    expect(() => localSettings({ PLAYWRIGHT_BASE_URL: "https://dispatch.example" })).toThrow(
      "PLAYWRIGHT_BASE_URL is set"
    );
    expect(() => localSettings({})).not.toThrow();
  });

  test("refuses a database named in the shell, unless it reuses the servers it was given", () => {
    expect(() => localSettings({ DATABASE_URL: "postgres://x" })).toThrow(
      "DATABASE_URL is set, and upstream's harness would run on that database and empty it"
    );
    expect(() =>
      localSettings({ DATABASE_URL: "postgres://x", DISPATCH_E2E_REUSE_SERVERS: "1" })
    ).not.toThrow();
  });
});

describe("the run's name", () => {
  test("is picked once, as a project key, and kept", () => {
    for (const env of [{}, { E2E_RUN_NAME: "" }] as NodeJS.ProcessEnv[]) {
      const name = nameRun(env);
      expect(name).toMatch(/^E2E[A-Z0-9]{1,7}$/);
      expect(nameRun(env)).toBe(name);
    }
  });

  test("refuses a name that is not a project key", () => {
    expect(() => nameRun({ E2E_RUN_NAME: "run-1" })).toThrow("not a project key");
  });
});
