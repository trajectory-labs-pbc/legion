import { afterEach, expect, spyOn, test } from "bun:test";
import { act } from "react";

import { stubFetch } from "../tests/fetch";
import { start } from "./start";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

test("installs the stale-chunk recovery before React takes the root for its first render", async () => {
  // No read answers: the app stays on its loading screen.
  cleanups.push(stubFetch(() => undefined).restore);
  const root = document.createElement("div");
  document.body.append(root);
  cleanups.push(() => root.remove());
  const steps: string[] = [];
  const addToWindow = window.addEventListener.bind(window);
  const onWindow = spyOn(window, "addEventListener").mockImplementation(
    (...args: Parameters<typeof window.addEventListener>) => {
      if (args[0] === "vite:preloadError") steps.push("recovery installed");
      addToWindow(...args);
    }
  );
  // React listens on the root when `createRoot` takes it, before it renders.
  const addToRoot = root.addEventListener.bind(root);
  const onRoot = spyOn(root, "addEventListener").mockImplementation(
    (...args: Parameters<typeof root.addEventListener>) => {
      if (steps.at(-1) !== "root taken") steps.push("root taken");
      addToRoot(...args);
    }
  );
  let app: { stop(): void } | undefined;
  await act(async () => {
    app = start(root);
  });
  onWindow.mockRestore();
  onRoot.mockRestore();
  cleanups.push(() => act(() => app?.stop()));
  expect(steps).toEqual(["recovery installed", "root taken"]);
  expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
});
