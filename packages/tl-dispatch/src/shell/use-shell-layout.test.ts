import { describe, expect, test } from "bun:test";

import { mainLayoutClass } from "./use-shell-layout";

describe("mainLayoutClass", () => {
  test.each([
    [{ sidebarHidden: false, hasMargin: false, marginHidden: false }, ""],
    [{ sidebarHidden: false, hasMargin: true, marginHidden: false }, ""],
    [{ sidebarHidden: false, hasMargin: true, marginHidden: true }, "xl:pr-20"],
    [{ sidebarHidden: true, hasMargin: false, marginHidden: false }, "xl:w-full xl:pl-20"],
    [{ sidebarHidden: true, hasMargin: true, marginHidden: false }, "xl:pl-20"],
    [{ sidebarHidden: true, hasMargin: true, marginHidden: true }, "xl:w-full xl:pl-20 xl:pr-20"],
  ])("leaves room for the folded rails: %o", (layout, expected) => {
    expect(mainLayoutClass(layout)).toBe(expected);
  });
});
