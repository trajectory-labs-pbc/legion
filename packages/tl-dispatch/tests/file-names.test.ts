import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { PACKAGE_ROOT } from "./source";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+)+$/;

test("every file and folder under src/ is named in kebab-case", () => {
  const src = join(PACKAGE_ROOT, "src");
  const named = readdirSync(src, { recursive: true, withFileTypes: true })
    .filter((entry) => !(entry.isDirectory() ? /^[a-z0-9]+(-[a-z0-9]+)*$/ : KEBAB).test(entry.name))
    .map((entry) => relative(PACKAGE_ROOT, join(entry.parentPath, entry.name)));
  expect(named).toEqual([]);
});
