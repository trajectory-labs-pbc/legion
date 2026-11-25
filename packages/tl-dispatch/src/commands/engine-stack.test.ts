import { describe, expect, test } from "bun:test";
import { appKeymap, createKeymap, DIALOG_SCOPE } from "@upstream-dispatch/features/shell/keymap";

import { appStack, trackEngineStack } from "./engine-stack";
import type { OverlayLayer } from "./focused-overlay";

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
    expect(stack.passes("under-most")).toBe(true);
    changed();
    expect(notified).toBe(1);
    changed();
    expect(notified).toBe(1);
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
    expect(appStack.liveScopes()).toEqual([DIALOG_SCOPE]);
    close();
    stop();
    expect(appStack.liveScopes()).toEqual(["global"]);
    expect(notified).toBe(2);
  });
});
