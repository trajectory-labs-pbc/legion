import { expect, test } from "bun:test";

import { sourceFiles } from "./source";

const scripts = sourceFiles().filter((file) => /\.[cm]?[jt]sx?$/.test(file.path));
const paths = (pattern: RegExp) =>
  scripts
    .filter((file) => pattern.test(file.text))
    .map((file) => file.path)
    .sort();

test("the app draws the warning colour only through the needs-you mark", () => {
  // The mark is the UI package's AttentionMark; a warning class here would be a second look.
  expect(paths(/\bwarning\b/i)).toEqual([]);
});

test("only the needs-you feature draws the attention mark", () => {
  expect(paths(/@legion\/ui\/components\/attention-mark/)).toEqual([
    "src/features/needs-you/needs-you-mark.tsx",
  ]);
});

test("only the Inbox count, in the sidebar and the narrow header, takes the needs-you mark", () => {
  expect(paths(/\bNeedsYouMark\b/)).toEqual([
    "src/features/needs-you/index.ts",
    "src/features/needs-you/needs-you-mark.tsx",
    "src/shell/compact-header.tsx",
    "src/shell/sidebar.tsx",
  ]);
  expect(paths(/\bneedsYou\b/)).toEqual(["src/shell/sidebar-data.ts", "src/shell/sidebar.tsx"]);
});
