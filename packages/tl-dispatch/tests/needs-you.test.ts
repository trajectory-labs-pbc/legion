import { expect, test } from "bun:test";

import { sourceFiles } from "./source";

const scripts = sourceFiles().filter((file) => /\.[cm]?[jt]sx?$/.test(file.path));

test("the app draws the warning colour only through the needs-you mark", () => {
  // The mark is the UI package's Count; a warning class, variant or token here would be a second look.
  expect(scripts.filter((file) => /\bwarning\b/i.test(file.text)).map((file) => file.path)).toEqual(
    []
  );
});

test("only the sidebar and the narrow header count what waits on the reader", () => {
  expect(scripts.filter((file) => /\bneedsYou\b/.test(file.text)).map((file) => file.path)).toEqual(
    ["src/shell/compact-header.tsx", "src/shell/sidebar-data.ts", "src/shell/sidebar.tsx"]
  );
});
