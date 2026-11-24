import { describe, expect, test } from "bun:test";

import { appCatalog } from "./app-catalog";
import {
  CatalogError,
  type CommandContext,
  type CommandDefinition,
  createCatalog,
} from "./catalog";
import { NAV_DESTINATIONS, navCommandName } from "./nav";

function global(commands: CommandDefinition[]): CommandContext {
  return { name: "global", parent: null, scope: "global", commands };
}

function problemsOf(contexts: CommandContext[]): readonly string[] {
  try {
    createCatalog(contexts);
  } catch (error) {
    if (error instanceof CatalogError) return error.problems;
    throw error;
  }
  return [];
}

const go = (name: string, keys: string[]): CommandDefinition => ({
  name,
  label: name,
  keys,
  group: "other",
});

describe("the app's catalog", () => {
  test("loads, with ids derived from context and name", () => {
    expect(appCatalog.command("global.search")?.keys).toEqual(["$mod+k", "/"]);
    expect(appCatalog.command("global.go-inbox")?.keys).toEqual(["g i"]);
  });

  test("gives each sidebar destination one command, with its chord when it has a key", () => {
    for (const destination of NAV_DESTINATIONS) {
      const command = appCatalog.command(`global.${navCommandName(destination)}`);
      expect(command?.keys).toEqual(destination.key === undefined ? [] : [`g ${destination.key}`]);
    }
  });
});

describe("the catalog refuses, when it loads", () => {
  test("two commands with one key on a chain", () => {
    const problems = problemsOf([
      global([go("a", ["x"])]),
      { name: "page", parent: "global", scope: "project", commands: [go("b", ["x"])] },
    ]);
    expect(problems).toEqual([
      `"page.b" (x) and "global.a" (x) on the chain of "page" have the same key`,
    ]);
  });

  test("$mod overlapping Control on a chain", () => {
    expect(problemsOf([global([go("a", ["$mod+j"]), go("b", ["Control+j"])])])).toHaveLength(1);
  });

  test("a single key that starts a chord", () => {
    expect(problemsOf([global([go("a", ["g"]), go("b", ["g i"])])])).toEqual([
      `"global.a" (g) and "global.b" (g i) on the chain of "global" have a key that starts the other's chord`,
    ]);
  });

  test("two commands with one name", () => {
    expect(problemsOf([global([go("a", ["x"]), go("a", ["y"])])])).toEqual([
      `two commands are named "global.a"`,
    ]);
  });

  test("a broken chain, a cycle, and a context that does not reach global", () => {
    const problems = problemsOf([
      global([]),
      { name: "orphan", parent: "missing", scope: "project", commands: [] },
      { name: "a", parent: "b", scope: "project", commands: [] },
      { name: "b", parent: "a", scope: "project", commands: [] },
    ]);
    expect(problems).toContain(`context "orphan" extends "missing", which does not exist`);
    expect(problems.some((problem) => problem.includes("has a cycle"))).toBe(true);
  });

  test("a catalog with no global context", () => {
    expect(problemsOf([{ name: "page", parent: null, scope: "project", commands: [] }])).toContain(
      `no "global" context`
    );
  });

  test("a chord that starts with a key other than G, O or N", () => {
    expect(problemsOf([global([go("a", ["t s"])])])).toEqual([
      `"global.a": the chord "t s" starts with neither G, O nor N`,
    ]);
  });

  test("a key the browser keeps, however its modifier is written", () => {
    expect(problemsOf([global([go("a", ["Control+w"]), go("b", ["$mod+Shift+r"])])])).toEqual([
      `"global.a": the browser keeps "Control+w"`,
      `"global.b": the browser keeps "$mod+Shift+r"`,
    ]);
  });

  test("a destructive command outside the destructive section", () => {
    const remove: CommandDefinition = {
      name: "delete",
      label: "Delete",
      group: "change",
      destructive: true,
    };
    expect(problemsOf([global([remove])])).toEqual([
      `"global.delete" is destructive but sits in the "change" section`,
    ]);
  });

  test("every problem at once", () => {
    expect(problemsOf([global([go("a", ["t s"]), go("a", ["$mod+w"])])])).toHaveLength(3);
  });

  test("but lets two pages that are never live together use one key", () => {
    expect(
      problemsOf([
        global([]),
        { name: "inbox", parent: "global", scope: "inbox", commands: [go("next", ["j"])] },
        { name: "agents", parent: "global", scope: "agents", commands: [go("next", ["j"])] },
      ])
    ).toEqual([]);
  });
});
