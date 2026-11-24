import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");

/** The files of `src/ui` this package writes; every other one comes from `shadcn add`. */
const OWN = ["src/ui/control-scale.ts", "src/ui/tokens.css"];

/** The files biome leaves as the registry wrote them. */
function registryFiles(): string[] {
  const config = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8")) as {
    overrides?: { includes?: string[] }[];
  };
  return config.overrides?.flatMap((override) => override.includes ?? []) ?? [];
}

function uiFiles(dir = join(ROOT, "src/ui")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? uiFiles(join(dir, entry.name)) : [relative(ROOT, join(dir, entry.name))]
  );
}

describe("src/ui", () => {
  test("holds the registry's files, each kept as written, and the package's own, named", () => {
    const registry = registryFiles();
    expect(registry.filter((file) => !existsSync(join(ROOT, file)))).toEqual([]);
    expect(uiFiles().filter((file) => !registry.includes(file) && !OWN.includes(file))).toEqual([]);
  });
});
