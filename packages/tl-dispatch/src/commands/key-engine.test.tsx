import { describe, expect, test } from "bun:test";
import {
  createKeymap,
  DIALOG_SCOPE,
  type Keymap,
  type KeymapOptions,
  type KeymapScope,
  useKeymapScope,
} from "@upstream-dispatch/features/shell/keymap";

import { render } from "../../tests/react";
import { appStack, UPSTREAM } from "./engine-stack";
import { clashes, keyChecker } from "./keys";

// What the catalog and its bindings rely on in upstream's key engine, driven through its public
// API, so an engine change fails here and not in the app.

function engine(options: KeymapOptions = {}): Keymap {
  return createKeymap({ isMac: false, setTimeout: () => 0, clearTimeout: () => {}, ...options });
}

function press(keymap: Keymap, init: KeyboardEventInit, target?: HTMLElement): void {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  if (target === undefined) {
    keymap.handleKeyDown(event);
    return;
  }
  const listener = (fired: Event) => keymap.handleKeyDown(fired as KeyboardEvent);
  target.addEventListener("keydown", listener);
  target.dispatchEvent(event);
  target.removeEventListener("keydown", listener);
}

function bound(keymap: Keymap, keys: string, scope: KeymapScope = "global") {
  const fired: string[] = [];
  keymap.register(scope, [{ id: keys, keys, label: keys, run: () => fired.push(keys) }]);
  return fired;
}

describe("upstream's key engine", () => {
  test("fires a chord on its two presses, in order", () => {
    const keymap = engine();
    const fired = bound(keymap, "g i");
    press(keymap, { key: "g", code: "KeyG" });
    expect(keymap.pending()).toBe("g");
    press(keymap, { key: "i", code: "KeyI" });
    expect(fired).toEqual(["g i"]);
  });

  test("reads $mod as Control or Meta", () => {
    const keymap = engine();
    const fired = bound(keymap, "$mod+k");
    press(keymap, { key: "k", code: "KeyK", ctrlKey: true });
    press(keymap, { key: "k", code: "KeyK", metaKey: true });
    press(keymap, { key: "k", code: "KeyK" });
    expect(fired).toEqual(["$mod+k", "$mod+k"]);
  });

  test("matches a letter's Shift exactly, and a symbol by the character it types", () => {
    const keymap = engine();
    const shifted = bound(keymap, "Shift+S");
    const question = bound(keymap, "?");
    press(keymap, { key: "s", code: "KeyS" });
    press(keymap, { key: "S", code: "KeyS", shiftKey: true });
    press(keymap, { key: "?", code: "Slash", shiftKey: true });
    expect([...shifted, ...question]).toEqual(["Shift+S", "?"]);
  });

  test("on a Mac, matches an Alt combo by the key's position, not the character Option types", () => {
    const mac = engine({ isMac: true });
    const other = engine({ isMac: false });
    const onMac = bound(mac, "$mod+Alt+m");
    const elsewhere = bound(other, "$mod+Alt+m");
    const init = { key: "µ", code: "KeyM", metaKey: true, altKey: true };
    press(mac, init);
    press(other, init);
    expect(onMac).toEqual(["$mod+Alt+m"]);
    expect(elsewhere).toEqual([]);
  });

  test("fires a binding while a field has focus only when it says inEditable", () => {
    const keymap = engine();
    const fired: string[] = [];
    keymap.register("global", [
      { id: "k", keys: "$mod+k", label: "k", inEditable: true, run: () => fired.push("$mod+k") },
      { id: "slash", keys: "/", label: "slash", run: () => fired.push("/") },
    ]);
    const field = document.createElement("textarea");
    document.body.append(field);
    press(keymap, { key: "/", code: "Slash" }, field);
    press(keymap, { key: "k", code: "KeyK", ctrlKey: true }, field);
    field.remove();
    expect(fired).toEqual(["$mod+k"]);
  });

  test("consults only the dialog scope while a dialog is on its stack", () => {
    const keymap = engine();
    const global = bound(keymap, "c");
    const dialog = bound(keymap, "x", DIALOG_SCOPE);
    const pop = keymap.pushScope(DIALOG_SCOPE);
    press(keymap, { key: "c", code: "KeyC" });
    press(keymap, { key: "x", code: "KeyX" });
    pop();
    press(keymap, { key: "c", code: "KeyC" });
    expect(global).toEqual(["c"]);
    expect(dialog).toEqual(["x"]);
  });

  test("in one scope, fires the first registration whose when() holds", () => {
    const keymap = engine();
    const fired: string[] = [];
    keymap.register("global", [
      { id: "first", keys: "x", label: "first", when: () => false, run: () => fired.push("first") },
      { id: "second", keys: "x", label: "second", run: () => fired.push("second") },
      { id: "third", keys: "x", label: "third", run: () => fired.push("third") },
    ]);
    press(keymap, { key: "x", code: "KeyX" });
    expect(fired).toEqual(["second"]);
  });

  test("in strict mode, throws on a key that starts another, in any scope, but not on equal keys", () => {
    const keymap = engine({ strict: true });
    bound(keymap, "g i");
    expect(() => bound(keymap, "g", "issue")).toThrow("conflict");
    expect(() => bound(keymap, "g i", DIALOG_SCOPE)).not.toThrow();
  });

  test("offers a single-key binding in the palette by default, not one that fires while typing", () => {
    const keymap = engine();
    keymap.register("global", [
      { id: "help", keys: "?", label: "Keyboard shortcuts", run: () => {} },
      { id: "search", keys: "$mod+k", label: "Search", inEditable: true, run: () => {} },
      { id: "only", keys: "/", label: "Slash", palette: false, run: () => {} },
      { id: "chord", keys: "g i", label: "Go", run: () => {} },
    ]);
    expect(keymap.actions().map((action) => action.id)).toEqual(["chord", "help"]);
  });

  test("goes through the pushScope property when upstream's hook opens a dialog", () => {
    function UpstreamDialog() {
      useKeymapScope(DIALOG_SCOPE);
      return null;
    }
    expect(appStack.top()).toBeUndefined();
    const mounted = render(<UpstreamDialog />);
    expect(appStack.top()).toBe(UPSTREAM);
    mounted.unmount();
    expect(appStack.top()).toBeUndefined();
  });
});

describe("the catalog's clash probe", () => {
  test.each([
    ["x", "x", true],
    ["x", "X", true],
    ["$mod+k", "Control+k", true],
    ["g", "g i", true],
    ["g i", "g", true],
    ["g i", "g a", false],
    ["Shift+s", "s", false],
    ["$mod+k", "k", false],
  ])("%s against %s: %p", (held, keys, expected) => {
    expect(clashes(keyChecker([held]), keys)).toBe(expected);
  });
});
