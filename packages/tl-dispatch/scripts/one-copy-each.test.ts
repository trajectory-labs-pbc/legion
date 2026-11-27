import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { packageRoot } from "../../../scripts/third-party-notices";
import { bundleCopyProblems } from "./one-copy-each";

type Versions = Record<string, string>;
const manifest = (dir: string) =>
  JSON.parse(readFileSync(join(import.meta.dir, dir, "package.json"), "utf8")) as {
    uiPackages: string[];
    dependencies: Versions;
    devDependencies: Versions;
    peerDependencies?: Versions;
  };

const own = "/repo/packages/tl-dispatch/node_modules/";
const root = "/repo/node_modules/.bun/react@19.2.8/node_modules/react";

describe("one copy of each shared package in the bundle", () => {
  test("passes one root-install copy, virtual ids included", () => {
    expect(
      bundleCopyProblems(
        [
          `${root}/index.js`,
          `\0${root}/cjs/react.production.js?commonjs-exports`,
          "/repo/src/x.ts",
        ],
        { root: ["react"], ui: [] },
        own
      )
    ).toEqual([]);
  });

  test("names a second copy", () => {
    const second = "/repo/node_modules/.bun/react@19.3.1/node_modules/react";
    expect(
      bundleCopyProblems(
        [`${root}/index.js`, `${second}/index.js`],
        { root: ["react"], ui: [] },
        own
      )
    ).toEqual([`react (${root}, ${second})`]);
  });

  test("passes a UI package from this app's install, and names one from packages/ui's", () => {
    const packages = { root: [], ui: ["cn"] };
    const theirs = "/repo/packages/ui/node_modules/cn";
    expect(bundleCopyProblems([`${own}cn/dist/index.js`], packages, own)).toEqual([]);
    expect(bundleCopyProblems([`${theirs}/dist/index.js`], packages, own)).toEqual([
      `cn (${theirs})`,
    ]);
    expect(
      bundleCopyProblems([`${own}cn/dist/index.js`, `${theirs}/dist/index.js`], packages, own)
    ).toEqual([`cn (${own}cn, ${theirs})`]);
  });

  test("names a copy in this app's own install", () => {
    expect(bundleCopyProblems([`${own}react/index.js`], { root: ["react"], ui: [] }, own)).toEqual([
      `react (${own}react)`,
    ]);
  });

  // The build bundles this app's copy; the tests and the type check load packages/ui's.
  test("this app and packages/ui pin each UI package at one version", () => {
    const app = manifest("..");
    const ui = manifest("../../ui");
    const pins = (versions: Versions | undefined) =>
      Object.fromEntries(app.uiPackages.map((name) => [name, versions?.[name]]));
    expect(pins(ui.devDependencies)).toEqual(pins(app.dependencies));
    expect(pins(ui.peerDependencies)).toEqual(pins(app.dependencies));
  });

  // The build runs upstream's config: its plugins, and the vite its notices name, are its install's.
  test("this app and upstream's web resolve the same vite and plugins", () => {
    const resolved = (dir: string) =>
      ["vite", "@vitejs/plugin-react", "@tailwindcss/vite"].map((name) =>
        packageRoot(name, join(import.meta.dir, dir))
      );
    expect(resolved("..")).toEqual(resolved("../../dispatch/web"));
  });
});
