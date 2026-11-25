import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { REGISTRY_FILES } from "./design-config";
import { PACKAGE_ROOT } from "./source";

function uiFiles(dir = join(PACKAGE_ROOT, "src/ui")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? uiFiles(join(dir, entry.name))
      : [relative(PACKAGE_ROOT, join(dir, entry.name)).split("\\\\").join("/")]
  );
}

describe("src/ui", () => {
  // The design rules and biome skip src/ui, so a file put there skips them too unless listed.
  test("holds the registry's files and no other", () => {
    expect(uiFiles().sort()).toEqual([...REGISTRY_FILES].sort());
  });
});
