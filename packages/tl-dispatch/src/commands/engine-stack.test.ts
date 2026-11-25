import { describe, expect, test } from "bun:test";
import { appKeymap, DIALOG_SCOPE } from "@upstream-dispatch/features/shell/keymap";

import { appStack } from "./engine-stack";

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
    expect(appStack.top()).toBe("upstream");
    close();
    stop();
    expect(appStack.top()).toBeUndefined();
    expect(notified).toBe(2);
  });
});
