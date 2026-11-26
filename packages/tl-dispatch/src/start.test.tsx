import { afterEach, expect, spyOn, test } from "bun:test";
import { act } from "react";

import { holdReads } from "../tests/network";
import { start } from "./start";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

test("SHL-38 installs the stale-chunk recovery before React takes the root for its first render", async () => {
  // The sign-in check never answers: the app stays on its loading screen.
  holdReads("/auth/whoami");
  const root = document.createElement("div");
  document.body.append(root);
  cleanups.push(() => root.remove());
  const steps: string[] = [];
  // Each spy goes on the object that owns the method, so its restore leaves no copy behind.
  const owner = (target: EventTarget): EventTarget => {
    let found: object = target;
    while (!Object.hasOwn(found, "addEventListener")) found = Object.getPrototypeOf(found);
    return found as EventTarget;
  };
  const spies = [...new Set([owner(window), owner(root)])].map((owned) => {
    const add = owned.addEventListener;
    return spyOn(owned, "addEventListener").mockImplementation(function (
      this: EventTarget | undefined,
      ...args: Parameters<EventTarget["addEventListener"]>
    ) {
      const target = this ?? window;
      if (target === window && args[0] === "vite:preloadError") steps.push("recovery installed");
      // React listens on the root when `createRoot` takes it, before it renders.
      if (target === root && steps.at(-1) !== "root taken") steps.push("root taken");
      add.apply(target, args);
    });
  });
  let app: { stop(): void } | undefined;
  await act(async () => {
    app = start(root);
  });
  for (const spy of spies) spy.mockRestore();
  cleanups.push(() => act(() => app?.stop()));
  expect(steps).toEqual(["recovery installed", "root taken"]);
  expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
});
