import { expect, test } from "bun:test";

import { sourceFiles } from "./source";

const scripts = sourceFiles().filter((file) => /\.[cm]?[jt]sx?$/.test(file.path));
const naming = (pattern: RegExp) =>
  scripts.filter((file) => pattern.test(file.text)).map((file) => file.path);

test("only features/needs-you imports AttentionMark", () => {
  const importers = naming(/@legion\/ui\/components\/attention-mark/);
  expect(importers).not.toHaveLength(0);
  expect(importers.filter((path) => !path.startsWith("src/features/needs-you/"))).toEqual([]);
});

test("no script names the warning colour: the mark is the only way to draw it", () => {
  expect(naming(/\bwarning\b/i)).toEqual([]);
});
