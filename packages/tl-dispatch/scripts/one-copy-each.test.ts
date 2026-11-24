import { describe, expect, test } from "bun:test";

import { bundleCopyProblems } from "./one-copy-each";

const own = "/repo/packages/tl-dispatch/node_modules/";
const root = "/repo/node_modules/.bun/react@19.2.8/node_modules/react";

describe("one copy of each root package in the bundle", () => {
  test("passes one root-install copy, virtual ids included", () => {
    expect(
      bundleCopyProblems(
        [
          `${root}/index.js`,
          `\0${root}/cjs/react.production.js?commonjs-exports`,
          "/repo/src/x.ts",
        ],
        ["react"],
        own
      )
    ).toEqual([]);
  });

  test("names a second copy", () => {
    const second = "/repo/node_modules/.bun/react@19.3.1/node_modules/react";
    expect(bundleCopyProblems([`${root}/index.js`, `${second}/index.js`], ["react"], own)).toEqual([
      `react (${root}, ${second})`,
    ]);
  });

  test("names a copy in this app's own install", () => {
    expect(bundleCopyProblems([`${own}react/index.js`], ["react"], own)).toEqual([
      `react (${own}react)`,
    ]);
  });
});
