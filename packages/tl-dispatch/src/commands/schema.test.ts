import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { type KeyRegistration, keyRegistrations } from "../../tests/key-registrations";
import { UPSTREAM_WEB } from "../../tests/source";
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

/**
 * Upstream's Shift+M binding takes its id and label from the frame it is in, so the scan reads
 * neither; the catalog's command is the plain shell's.
 */
const FRAMED = { keys: "Shift+M", name: "toggle-margin", label: "Toggle margin" } as const;

interface ShellBinding {
  id: string;
  keys: string[];
  label: string | undefined;
  inEditable: boolean;
  palette: boolean;
}

/** Each global binding upstream's shell registers, read from its source, as the engine runs it. */
function shellBindings(): ShellBinding[] {
  const byLine = new Map<number, KeyRegistration[]>();
  for (const registration of keyRegistrations(join(UPSTREAM_WEB, "app.tsx"))) {
    if (registration.scope !== "global") continue;
    byLine.set(registration.line, [...(byLine.get(registration.line) ?? []), registration]);
  }
  return [...byLine.values()].map((registrations) => {
    const [first] = registrations;
    if (first === undefined) throw new Error("a binding with no key");
    const framed =
      first.id === undefined &&
      first.keys === FRAMED.keys &&
      first.label?.includes(`"${FRAMED.label}"`) === true;
    if (first.id === undefined && !framed) {
      throw new Error(`app.tsx:${first.line} binds ${first.keys} under an id no scan reads`);
    }
    const inEditable = first.inEditable === true;
    return {
      id: `global.${framed ? FRAMED.name : first.id}`,
      keys: registrations.map((registration) => registration.keys),
      label: framed ? FRAMED.label : first.label,
      inEditable,
      // The engine's own default, which the palette reads.
      palette: first.palette ?? (registrations.length <= 1 && !inEditable),
    };
  });
}

describe("the app's catalog", () => {
  test("holds every key the shell binds today, with the same label, typing and palette row", () => {
    const shell = shellBindings();
    expect(shell.length).toBeGreaterThan(5);
    for (const binding of shell) {
      const command = appCatalog.find(binding.id);
      expect({
        id: command?.id,
        keys: command?.keys,
        label: command?.label,
        inEditable: command?.inEditable === true,
        palette: command?.hideFrom?.includes("palette") !== true,
      }).toEqual(binding);
    }
  });

  test("adds only the pages with no letter, as palette commands", () => {
    const live = new Set(shellBindings().map((binding) => binding.id));
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

  test("a key of a command that starts another key of it, but not its equal keys", () => {
    expect(problemsOf([global([go("a", ["g", "g i"])])])).toEqual([
      clash("global.a", "g", "global.a", "g i"),
    ]);
    expect(problemsOf([global([go("a", ["x", "X"])])])).toEqual([]);
  });

  test("two keys that differ by a Shift the engine ignores, on a symbol or a digit", () => {
    expect(problemsOf([global([go("a", ["?"]), go("b", ["Shift+?"])])])).toEqual([
      clash("global.a", "?", "global.b", "Shift+?"),
    ]);
    expect(problemsOf([global([go("a", ["1"]), go("b", ["$mod+Shift+1"])])])).toEqual([]);
    expect(problemsOf([global([go("a", ["s"]), go("b", ["Shift+s"])])])).toEqual([]);
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

  test("a context in the dialog scope: an overlay has no commands of its own yet", () => {
    expect(
      problemsOf([global([]), { name: "sheet", parent: "global", scope: "dialog", commands: [] }])
    ).toEqual([
      `context "sheet" registers in the dialog scope: an overlay has no commands of its own yet`,
    ]);
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
    expect(problemsOf([global([go("a", ["Hyper+x"]), go("b", ["$mod++"])])])).toEqual([
      `"global.a": Keymap: unknown modifier "Hyper" in "Hyper+x"`,
      `"global.b": Keymap: "$mod++" has no key`,
    ]);
  });

  test("every problem at once", () => {
    expect(problemsOf([global([go("a", ["t s"]), go("a", ["$mod+w"])])])).toHaveLength(3);
  });
});
