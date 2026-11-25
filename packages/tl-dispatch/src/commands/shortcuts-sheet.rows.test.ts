import { describe, expect, test } from "bun:test";
import {
  createKeymap,
  DIALOG_SCOPE,
  type KeyBinding,
  type Keymap,
} from "@upstream-dispatch/features/shell/keymap";

import { createLayerSource } from "../../tests/layers";
import { defineActions } from "./actions";
import { contextBindings } from "./bindings";
import { trackEngineStack } from "./engine-stack";
import { COMMAND_GROUPS } from "./groups";
import { liveShortcuts } from "./live-shortcuts";
import { createCatalog } from "./schema";
import { shownSections } from "./shortcuts-sheet-view";

const catalog = createCatalog([
  {
    name: "global",
    parent: null,
    scope: "global",
    commands: [
      { name: "create", label: "Create issue", keys: ["c"] },
      { name: "inbox-drawer", label: "Open the inbox", keys: ["i"], group: COMMAND_GROUPS.layout },
      { name: "next", label: "Next", keys: ["j", "ArrowDown"] },
      { name: "secret", label: "Secret", keys: ["Shift+X"], hideFrom: ["sheet"] },
      { name: "off", label: "Off", keys: ["x"] },
    ],
  },
]);

const globalActions = defineActions(catalog, "global", (_r: null, _o: null) => ({
  create: { run: () => {} },
  "inbox-drawer": { run: () => {} },
  next: { run: () => {} },
  secret: { run: () => {} },
  off: { run: () => {}, enabled: false },
}));

function page(id: string, keys: KeyBinding["keys"], label = id): KeyBinding {
  return { id, keys, label, run: () => {} };
}

function setup() {
  const keymap: Keymap = createKeymap({
    isMac: false,
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  const layers = createLayerSource();
  const stack = trackEngineStack(keymap, layers);
  const global = contextBindings(catalog, "global", globalActions(null, null), stack);
  keymap.register("global", global.own);
  keymap.register(
    DIALOG_SCOPE,
    global.underOverlays.map(({ binding }) => binding)
  );
  const sheet = () =>
    liveShortcuts(keymap.describe(), stack.liveScopes(), catalog, {
      "inbox:snooze": {
        upstream: "Snooze the focused ask, or every selected ask",
        label: "Snooze",
      },
    }).map(({ group, rows }) => [
      group.label,
      rows.map((row) => `${row.label}: ${row.keys.join(" | ")}`),
    ]);
  return { keymap, layers, stack, sheet };
}

describe("the shortcuts sheet's rows", () => {
  test("list the live scopes' enabled keys, innermost first, our commands by their group", () => {
    const { keymap, sheet } = setup();
    keymap.register("inbox", [page("archive", "e", "Archive")]);
    keymap.register("board", [page("move", "m", "Move")]);
    keymap.pushScope("inbox");
    expect(sheet()).toEqual([
      ["Inbox", ["Archive: e"]],
      ["General", ["Create issue: c", "Next: j | ArrowDown"]],
      ["Layout", ["Open the inbox: i"]],
    ]);
  });

  test("leave out a key an inner scope takes, and a command left with no key", () => {
    const { keymap, sheet } = setup();
    keymap.register("inbox", [page("open", "i", "Open item"), page("go", "c i", "Go")]);
    keymap.pushScope("inbox");
    expect(sheet()).toEqual([
      ["Inbox", ["Open item: i", "Go: c i"]],
      ["General", ["Next: j | ArrowDown"]],
    ]);
  });

  test("hide Escape and every command hidden from the sheet; their keys still run", () => {
    const { keymap, sheet } = setup();
    keymap.register("inbox", [
      page("back", "Escape", "Back"),
      page("both", ["Escape", "b"], "Both"),
    ]);
    keymap.pushScope("inbox");
    const rows = sheet().flatMap(([, rows]) => rows);
    expect(rows).toContain("Both: b");
    expect(
      rows.some((row) => String(row).startsWith("Back") || String(row).startsWith("Secret"))
    ).toBe(false);
  });

  test("list one row per command: upstream's bindings of one label merge, keys kept in order", () => {
    const { keymap, sheet } = setup();
    keymap.register("inbox", [
      page("down", "j", "Next item"),
      page("down-arrow", "ArrowDown", "Next item"),
    ]);
    keymap.pushScope("inbox");
    expect(sheet()[0]).toEqual(["Inbox", ["Next item: j | ArrowDown"]]);
  });

  test("name an upstream binding by our short label for its scope and id, where we give one", () => {
    const { keymap, sheet } = setup();
    keymap.register("inbox", [
      page("snooze", "h", "Snooze the focused ask, or every selected ask"),
      page("archive", "e", "Archive"),
    ]);
    keymap.register("board", [page("snooze", "z", "Snooze the card")]);
    keymap.pushScope("board");
    keymap.pushScope("inbox");
    expect(sheet().slice(0, 2)).toEqual([
      ["Inbox", ["Snooze: h", "Archive: e"]],
      ["Board", ["Snooze the card: z"]],
    ]);
  });

  test("under a dialog, list the dialog's keys and our global copies once, under their group", () => {
    const { keymap, layers, sheet } = setup();
    keymap.register("inbox", [page("archive", "e", "Archive")]);
    keymap.pushScope("inbox");
    keymap.register(DIALOG_SCOPE, [page("save", "$mod+Enter", "Save")]);
    layers.open("drawer");
    expect(sheet()).toEqual([
      ["General", ["Create issue: c", "Next: j | ArrowDown"]],
      ["Layout", ["Open the inbox: i"]],
      ["Dialog", ["Save: $mod+Enter"]],
    ]);
  });
});

describe("the sheet's filter", () => {
  const sections = [
    {
      group: COMMAND_GROUPS.general,
      rows: [
        { id: "a", label: "Create issue", keys: ["c"] },
        { id: "b", label: "Search", keys: ["/"] },
      ],
    },
    {
      group: COMMAND_GROUPS.layout,
      rows: [{ id: "c", label: "Toggle sidebar", keys: ["Shift+S"] }],
    },
  ];

  test("writes each row's keys as chips for the reader's platform", () => {
    expect(shownSections(sections, false)).toEqual([
      {
        id: "general",
        label: "General",
        rows: [
          { id: "a", label: "Create issue", keys: [["C"]] },
          { id: "b", label: "Search", keys: [["/"]] },
        ],
      },
      {
        id: "layout",
        label: "Layout",
        rows: [{ id: "c", label: "Toggle sidebar", keys: [["Shift+S"]] }],
      },
    ]);
    expect(shownSections(sections, true)[1]?.rows[0]?.keys).toEqual([["⇧S"]]);
  });
});
