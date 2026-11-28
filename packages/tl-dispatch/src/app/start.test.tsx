import { afterEach, expect, test } from "bun:test";
import { act } from "react";

import { holdReads } from "../../tests/network";
import { start } from "./start";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

test("draws the app in its root, on its loading screen until the sign-in check answers", async () => {
  holdReads("/auth/whoami");
  const root = document.createElement("div");
  document.body.append(root);
  cleanups.push(() => root.remove());
  let app: { stop(): void } | undefined;
  await act(async () => {
    app = start(root);
  });
  cleanups.push(() => act(() => app?.stop()));
  expect(root.querySelector('[aria-busy="true"]')).not.toBeNull();
});
