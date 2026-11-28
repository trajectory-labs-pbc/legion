import { describe, expect, test } from "bun:test";

import { askBeforeLeaving } from "./unload";

/** Whether the browser would ask before it leaves the page now. */
function asks(): boolean {
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  return leaving.defaultPrevented;
}

describe("askBeforeLeaving", () => {
  test("the browser asks until the prompt is let go", () => {
    const letGo = askBeforeLeaving();
    expect(asks()).toBe(true);
    letGo();
    expect(asks()).toBe(false);
  });
});
