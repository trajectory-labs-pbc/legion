import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  lockVersionProblems,
  resolvePackageDir,
  rootPackages,
  rootVersions,
} from "./link-root-packages";

const pkg = join(import.meta.dir, "..");

describe("the root packages", () => {
  test("resolve as Node does, from a parent's node_modules too", () => {
    const root = mkdtempSync(join(tmpdir(), "root-packages-"));
    mkdirSync(join(root, "node_modules/hoisted"), { recursive: true });
    writeFileSync(join(root, "node_modules/hoisted/package.json"), '{"version":"1.0.0"}');
    mkdirSync(join(root, "packages/dispatch"), { recursive: true });
    expect(resolvePackageDir("hoisted", join(root, "packages/dispatch"))).toBe(
      realpathSync(join(root, "node_modules/hoisted"))
    );
    expect(rootVersions(["hoisted"], join(root, "packages/dispatch"))).toEqual(
      new Map([["hoisted", "1.0.0"]])
    );
    expect(() => resolvePackageDir("absent", join(root, "packages/dispatch"))).toThrow(
      /absent is not installed where .* resolves it .* run `bun install` at the repository root; if upstream no longer depends on it, move it from rootPackages to the package's dependencies \(`bun add absent`\)/
    );
  });

  test("a lock that records another version of a root package is named", () => {
    const lock = '{\n  "packages": {\n    "react": ["react@19.3.1", "", {}, "sha512-x"],\n  }\n}\n';
    expect(lockVersionProblems(lock, new Map([["react", "19.2.8"]]))).toEqual([
      'bun.lock records react@19.3.1, which nothing installs, and the root install has 19.2.8: set "overrides": {"react": "19.2.8"} in package.json and run `bun install`',
    ]);
    expect(lockVersionProblems(lock, new Map([["react", "19.3.1"]]))).toEqual([]);
  });

  test("a package without a rootPackages list is refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "root-packages-"));
    writeFileSync(join(dir, "package.json"), '{"rootPackages":"react"}');
    expect(() => rootPackages(dir)).toThrow("has no rootPackages list");
  });

  test("this package's lock records each root package at the root install's version", () => {
    const lock = readFileSync(join(pkg, "bun.lock"), "utf8");
    expect(lockVersionProblems(lock, rootVersions(rootPackages(pkg)))).toEqual([]);
  });
});
