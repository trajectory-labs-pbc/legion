import { describe, expect, test } from "bun:test";
import {
  createKeymap,
  type KeyBinding,
  type Keymap,
} from "@upstream-dispatch/features/shell/keymap";

import { createOverlayLayers } from "../ui/overlay-layer";
import { bindOverlaysToKeymap, passThroughBindings, toBindings } from "./bindings";
import { type CommandContext, createCatalog } from "./catalog";
import { defineActions } from "./specs";

const catalog = createCatalog([
  {
    name: "global",
    parent: null,
    scope: "global",
    commands: [
      {
        name: "search",
        label: "Search",
        keys: ["$mod+k", "/"],
        group: "other",
        inEditable: ["$mod+k"],
      },
      { name: "go-inbox", label: "Go to Inbox", keys: ["g i"], group: "other" },
      { name: "undo", label: "Undo", keys: ["$mod+z"], group: "change", onlyWithoutOverlay: true },
      { name: "about", label: "About", group: "other" },
    ],
  },
  {
    name: "issue",
    parent: "global",
    scope: "issue",
    commands: [
      { name: "close", label: "Close issue", keys: ["Shift+C"], group: "change" },
      { name: "next", label: "Next", keys: ["j", "ArrowDown"], group: "other" },
    ],
  },
] satisfies CommandContext[]);

function harness() {
  const keymap = createKeymap({ strict: true, setTimeout: () => 0, clearTimeout: () => {} });
  const ran: string[] = [];
  const press = (key: string, init: KeyboardEventInit & { target?: Element } = {}) => {
    const { target = document.body, ...rest } = init;
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key, ...rest });
    Object.defineProperty(event, "target", { value: target });
    keymap.handleKeyDown(event);
  };
  return { keymap, ran, press };
}

const globalActions = (ran: string[], enabled = true) =>
  defineActions(catalog, "global", (_record: null, _options: null) => ({
    search: { run: () => ran.push("search") },
    "go-inbox": { run: () => ran.push("go-inbox"), enabled },
    undo: { run: () => ran.push("undo") },
    about: { run: () => ran.push("about") },
  }))(null, null);

const issueActions = (ran: string[], closed: boolean) =>
  defineActions(catalog, "issue", (issue: { title: string }, _options: null) => ({
    close: { run: () => ran.push("close"), enabled: !closed, subject: issue.title },
    next: { run: () => ran.push("next") },
  }))({ title: "Fix the login" }, null);

function register(keymap: Keymap, scope: "global" | "issue", bindings: KeyBinding[]) {
  return keymap.register(scope, bindings);
}

describe("compiling commands to the key engine", () => {
  test("a registered command runs from its key and its chord", () => {
    const { keymap, ran, press } = harness();
    register(keymap, "global", toBindings(globalActions(ran)));
    press("g");
    press("i");
    press("/");
    expect(ran).toEqual(["go-inbox", "search"]);
  });

  test("keys that differ in whether they fire while typing become two bindings", () => {
    const { keymap, ran, press } = harness();
    register(keymap, "global", toBindings(globalActions(ran)));
    const field = document.createElement("textarea");
    press("/", { target: field });
    press("k", { target: field, ctrlKey: true });
    expect(ran).toEqual(["search"]);
  });

  test("a shut gate stops the key and drops the palette row", () => {
    const { keymap, ran, press } = harness();
    register(keymap, "global", toBindings(globalActions(ran, false)));
    press("g");
    press("i");
    expect(ran).toEqual([]);
    expect(keymap.actions().map((action) => action.id)).not.toContain("global.go-inbox");
  });

  test("a page's commands run only while its scope is on the stack", () => {
    const { keymap, ran, press } = harness();
    register(keymap, "issue", toBindings(issueActions(ran, false)));
    press("C", { shiftKey: true });
    const pop = keymap.pushScope("issue");
    press("C", { shiftKey: true });
    pop();
    press("C", { shiftKey: true });
    expect(ran).toEqual(["close"]);
  });

  test("the gate is read on every press", () => {
    const { keymap, ran, press } = harness();
    let closed = false;
    keymap.register(
      "issue",
      toBindings(issueActions(ran, false)).map((binding) => ({
        ...binding,
        when: () => !closed && binding.when?.() !== false,
      }))
    );
    keymap.pushScope("issue");
    press("C", { shiftKey: true });
    closed = true;
    press("C", { shiftKey: true });
    expect(ran).toEqual(["close"]);
  });

  test("the palette hides the keys it takes itself and keeps palette-only commands", () => {
    const { keymap, ran } = harness();
    register(keymap, "global", toBindings(globalActions(ran)));
    const rows = keymap.actions().map((action) => action.id);
    expect(rows).toContain("global.about");
    expect(rows).not.toContain("global.search");
    expect(rows).not.toContain("global.search:typing");
  });
});

describe("overlays", () => {
  test("an open overlay masks the page's commands, and closing it brings them back", () => {
    const { keymap, ran, press } = harness();
    const layers = createOverlayLayers();
    bindOverlaysToKeymap(layers, keymap);
    register(keymap, "global", toBindings(globalActions(ran), layers));
    const close = layers.open("menu");
    press("/");
    close();
    press("/");
    expect(ran).toEqual(["search"]);
  });

  test("a global command runs under a sheet but not under a menu or an alert dialog", () => {
    const { keymap, ran, press } = harness();
    const layers = createOverlayLayers();
    bindOverlaysToKeymap(layers, keymap);
    const specs = globalActions(ran);
    register(keymap, "global", toBindings(specs, layers));
    keymap.register("dialog", passThroughBindings(specs, layers));
    const sheet = layers.open("sheet");
    press("/");
    const menu = layers.open("menu");
    press("/");
    menu();
    sheet();
    const alert = layers.open("alert-dialog");
    press("/");
    alert();
    expect(ran).toEqual(["search"]);
  });

  test("an onlyWithoutOverlay command never runs under one", () => {
    const { keymap, ran, press } = harness();
    const layers = createOverlayLayers();
    bindOverlaysToKeymap(layers, keymap);
    const specs = globalActions(ran);
    register(keymap, "global", toBindings(specs, layers));
    keymap.register("dialog", passThroughBindings(specs, layers));
    const sheet = layers.open("sheet");
    press("z", { ctrlKey: true });
    sheet();
    press("z", { ctrlKey: true });
    expect(ran).toEqual(["undo"]);
  });
});
