import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { temporaryDirectory } from "../../test-fixtures/src/temporary-directories";
import {
  deployedSettings,
  localFiles,
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
    for (const phase of ["switch-to-upstream", "switch-to-new"] as const) {
      expect(files.filter((file) => runs(phase, file))).toEqual(["e2e/switch.multiprocess.e2e.ts"]);
      const env = deployedEnv({ E2E_PHASE: phase, E2E_SWITCH_SIGNAL: "/tmp/deployed" });
      expect(deployedSettings(env)).toMatchObject({ phase, switchSignal: "/tmp/deployed" });
    }
    expect(() => deployedSettings(deployedEnv({ E2E_PHASE: "switch-read" }))).toThrow(
      "E2E_PHASE is switch-read, not one of routes-and-flows, switch-to-upstream, switch-to-new."
    );
  });

  test("refuses a switch phase with no signal file to wait for", () => {
    for (const signal of [undefined, ""]) {
      const env = deployedEnv({ E2E_PHASE: "switch-to-new", E2E_SWITCH_SIGNAL: signal });
      expect(() => deployedSettings(env)).toThrow(
        "E2E_SWITCH_SIGNAL is not set: phase switch-to-new waits for that file"
      );
    }
    // A phase that is no phase is refused for that alone.
    expect(() => deployedSettings(deployedEnv({ E2E_PHASE: "switch" }))).not.toThrow(
      "E2E_SWITCH_SIGNAL"
    );
    expect(
      deployedSettings(deployedEnv({ E2E_SWITCH_SIGNAL: "/tmp/deployed" }))
    ).not.toHaveProperty("switchSignal");
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

  test("refuses a storage state with no session cookie", () => {
    const start = (state: string) => () =>
      deployedSettings(deployedEnv({ E2E_STORAGE_STATE: state }));
    expect(start(stateFile([{ ...session, name: "other" }]))).toThrow("holds no dsession cookie.");
    expect(start(stateFile("{}"))).toThrow("holds no dsession cookie.");
    expect(start(stateFile("{"))).toThrow("is not a storage state");
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

  test("takes a database named in the shell only when it is a throwaway one", () => {
    expect(() =>
      localSettings({ DATABASE_URL: "postgres://x", E2E_LOCAL_DATABASE: "throwaway" })
    ).not.toThrow();
    expect(() =>
      localSettings({ DATABASE_URL: "postgres://x", E2E_LOCAL_DATABASE: "yes" })
    ).toThrow("E2E_LOCAL_DATABASE is yes, and its one value is throwaway.");
    // Empty is unset, as E2E_SWITCH_SIGNAL is.
    expect(() => localSettings({ DATABASE_URL: "postgres://x", E2E_LOCAL_DATABASE: "" })).toThrow(
      "DATABASE_URL is set"
    );
  });

  test("runs the switch file only in two-process mode, and every other file otherwise", () => {
    const files = ["e2e/routes.e2e.ts", "e2e/switch.multiprocess.e2e.ts"];
    const runs = (processes: number) => {
      const { testIgnore, testMatch } = localFiles(processes);
      return files.filter(
        (file) => testMatch.test(file) && !testIgnore.some((pattern) => pattern.test(file))
      );
    };
    expect(runs(1)).toEqual(["e2e/routes.e2e.ts"]);
    expect(runs(2)).toEqual(["e2e/switch.multiprocess.e2e.ts"]);
  });
});

describe("the browser contexts", () => {
  // A context the deployed mode does not guard could sign the person out of every session, so
  // test.ts makes each one: `context`, and `emptyContext` for a test that needs its own.
  test("are made in test.ts alone", () => {
    const e2e = fileURLToPath(new URL(".", import.meta.url));
    const makesContext =
      /\bnewContext\(|\bbrowser\.newPage\(|\b(asUser|withAlice|asPlainHttpUser)\b/;
    const makers = readdirSync(e2e)
      .filter((file) => file.endsWith(".ts") && file !== "test.ts" && file !== "modes.test.ts")
      .filter((file) => makesContext.test(readFileSync(join(e2e, file), "utf8")));
    expect(makers).toEqual([]);
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
