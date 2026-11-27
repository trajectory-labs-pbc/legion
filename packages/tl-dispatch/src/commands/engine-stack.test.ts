import { describe, expect, test } from "bun:test";
import { appKeymap, createKeymap, DIALOG_SCOPE } from "@upstream-dispatch/features/shell/keymap";

import { press, testKeymap } from "../../tests/keymap";
import { appStack, type EngineStack, keysReach, passing, trackEngineStack } from "./engine-stack";
import type { OverlayLayer } from "./focused-overlay";
import { createCatalog } from "./schema";

describe("an engine stack", () => {
  test("tells its listeners of an overlay a render read first", () => {
    let open: readonly OverlayLayer[] = [];
    let changed = () => {};
    const stack = trackEngineStack(createKeymap(), {
      get: () => open,
      subscribe(listener) {
        changed = listener;
        return () => {};
      },
    });
    let notified = 0;
    stack.subscribe(() => {
      notified += 1;
    });
    open = [{ kind: "passthrough" }];
    // A render that runs between the overlay's opening and its focus event reads the stack.
    expect(stack.now().passes("under-most")).toBe(true);
    changed();
    expect(notified).toBe(1);
    changed();
    expect(notified).toBe(1);
  });

  test("reads the overlays once for a question that asks it twice", () => {
    let reads = 0;
    const open: readonly OverlayLayer[] = [{ kind: "passthrough" }];
    const stack = trackEngineStack(createKeymap(), {
      get: () => {
        reads += 1;
        return open;
      },
      subscribe: () => () => {},
    });
    const catalog = createCatalog([
      {
        name: "global",
        parent: null,
        scope: "global",
        commands: [{ name: "create", label: "Create", keys: ["c"] }],
      },
    ]);
    const asked = (question: () => unknown) => {
      const before = reads;
      question();
      return reads - before;
    };
    expect(asked(() => passing(stack))).toBe(1);
    expect(asked(() => keysReach(catalog, catalog.command("global.create"), stack))).toBe(1);
  });

  test("replaces a tracker an older copy of this module left on the window", () => {
    const keymap = createKeymap();
    const older = { subscribe: () => () => {} } as unknown as EngineStack;
    globalThis.__tlDispatchEngineStacks?.set(keymap, older);
    const stack = trackEngineStack(keymap, { get: () => [], subscribe: () => () => {} });
    expect(stack.now().liveScopes()).toEqual(["global"]);
  });
});

describe("a scope's cleanup", () => {
  test("run twice, leaves a second holder of the scope on the engine and in the stack", () => {
    const keymap = testKeymap();
    const stack = trackEngineStack(keymap, { get: () => [], subscribe: () => () => {} });
    const fired: string[] = [];
    keymap.register("issue", [{ id: "x", keys: "x", label: "X", run: () => fired.push("x") }]);
    keymap.pushScope("issue");
    const pop = keymap.pushScope("issue");
    pop();
    pop();
    expect(stack.now().liveScopes()).toEqual(["global", "issue"]);
    press(keymap, "x");
    expect(fired).toEqual(["x"]);
  });
});

describe("the live scopes", () => {
  test("list a scope pushed twice once, at its last place, where the engine reads it", () => {
    const keymap = createKeymap();
    const stack = trackEngineStack(keymap, { get: () => [], subscribe: () => () => {} });
    keymap.pushScope("issue");
    keymap.pushScope("document");
    keymap.pushScope("issue");
    expect(stack.now().liveScopes()).toEqual(["global", "document", "issue"]);
  });
});

describe("the app's engine stack", () => {
  test("survives its module running again, as a hot reload runs it: one tracker, one wrap", async () => {
    // A query makes the loader run the module a second time, against the same key engine.
    const specifier = `./engine-stack?again=${Date.now()}`;
    const again: { appStack: unknown } = await import(specifier);
    expect(again.appStack).toBe(appStack);
    let notified = 0;
    const stop = appStack.subscribe(() => {
      notified += 1;
    });
    const close = appKeymap.pushScope(DIALOG_SCOPE);
    expect(appStack.now().liveScopes()).toEqual([DIALOG_SCOPE]);
    close();
    stop();
    expect(appStack.now().liveScopes()).toEqual(["global"]);
    expect(notified).toBe(2);
  });
});
