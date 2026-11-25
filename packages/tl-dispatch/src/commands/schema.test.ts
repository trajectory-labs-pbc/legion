import { describe, expect, test } from "bun:test";

import { appCatalog } from "./app-catalog";
import { NAV_DESTINATIONS, navCommandName } from "./nav";
import { CatalogError, type CommandContext, type CommandDefinition, createCatalog } from "./schema";

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

const go = (name: string, keys: string[]): CommandDefinition => ({ name, label: name, keys });

const clash = (a: string, aKeys: string, b: string, bKeys: string) =>
  `"${a}" (${aKeys}) and "${b}" (${bKeys}) are live together and one press sequence matches both, or one starts the other`;

/** The keys the shell binds today (`src/shell/global-commands.ts`), as the engine sees them. */
const LIVE_KEYS: readonly CommandDefinition[] = [
  { name: "search", keys: ["$mod+k"], label: "Search and actions", inEditable: true },
  { name: "search-only", keys: ["/"], label: "Search", hideFrom: ["palette"] },
  { name: "help", keys: ["?"], label: "Keyboard shortcuts" },
  { name: "create", keys: ["c"], label: "Create issue" },
  { name: "go-inbox", keys: ["g i"], label: "Go to Inbox" },
  { name: "go-agents", keys: ["g a"], label: "Go to Agents" },
  { name: "go-settings", keys: ["g s"], label: "Go to Settings" },
  { name: "go-documents", keys: ["g d"], label: "Go to Documents" },
  { name: "go-project", keys: ["g p"], label: "Go to project…", hideFrom: ["palette"] },
  { name: "inbox-drawer", keys: ["i"], label: "Open the inbox" },
  { name: "toggle-sidebar", keys: ["Shift+S"], label: "Toggle sidebar" },
  { name: "toggle-margin", keys: ["Shift+M"], label: "Toggle margin" },
];

describe("the app's catalog", () => {
  test("holds every key the shell binds today, with the same keys, typing and palette rows", () => {
    for (const live of LIVE_KEYS) {
      const command = appCatalog.find(`global.${live.name}`);
      const catalogued: Partial<CommandDefinition> = {
        name: command?.name,
        keys: command?.keys,
        label: command?.label,
        inEditable: command?.inEditable,
        hideFrom: command?.hideFrom,
      };
      expect(catalogued).toEqual(live);
    }
  });

  test("adds only the pages with no letter, as palette commands", () => {
    const live = new Set(LIVE_KEYS.map((key) => `global.${key.name}`));
    const added = appCatalog.commandsOf("global").filter((command) => !live.has(command.id));
    expect(added.map((command) => `${command.id} ${command.keys?.join() ?? ""}`)).toEqual([
      "global.go-priorities ",
      "global.go-delivery ",
      "global.go-pipeline ",
      "global.go-machines ",
    ]);
  });

  test("gives each sidebar destination one command, with its chord when it has a key", () => {
    for (const destination of NAV_DESTINATIONS) {
      const command = appCatalog.command(`global.${navCommandName(destination.name)}`);
      expect(command.keys).toEqual("key" in destination ? [`g ${destination.key}`] : []);
    }
  });
});

describe("the catalog refuses, when it loads", () => {
  test("two commands with one key on a chain", () => {
    const problems = problemsOf([
      global([go("a", ["x"])]),
      { name: "page", parent: "global", scope: "project", commands: [go("b", ["x"])] },
    ]);
    expect(problems).toEqual([clash("global.a", "x", "page.b", "x")]);
  });

  test("two keys the engine reads as one press: $mod and Control, a letter's case", () => {
    expect(problemsOf([global([go("a", ["$mod+j"]), go("b", ["Control+j"])])])).toHaveLength(1);
    expect(problemsOf([global([go("a", ["x"]), go("b", ["X"])])])).toHaveLength(1);
  });

  test("a single key that starts a chord", () => {
    expect(problemsOf([global([go("a", ["g"]), go("b", ["g i"])])])).toEqual([
      clash("global.a", "g", "global.b", "g i"),
    ]);
  });

  test("one key in two contexts on different chains that share an engine scope", () => {
    const problems = problemsOf([
      global([]),
      { name: "tree", parent: "global", scope: "issue", commands: [go("open", ["o"])] },
      { name: "header", parent: "global", scope: "issue", commands: [go("pick", ["o p"])] },
    ]);
    expect(problems).toEqual([clash("tree.open", "o", "header.pick", "o p")]);
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

  test("a key the engine cannot read", () => {
    expect(problemsOf([global([go("a", ["Hyper+x"])])])).toEqual([
      `"global.a": Keymap: unknown modifier "Hyper" in "Hyper+x"`,
    ]);
  });

  test("every problem at once", () => {
    expect(problemsOf([global([go("a", ["t s"]), go("a", ["$mod+w"])])])).toHaveLength(3);
  });
});
