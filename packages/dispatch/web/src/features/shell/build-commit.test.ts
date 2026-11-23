import { afterEach, expect, test } from "bun:test";

import { buildCommit } from "./build-commit";

const globals = globalThis as { __DISPATCH_COMMIT__?: string };

afterEach(() => {
  Reflect.deleteProperty(globals, "__DISPATCH_COMMIT__");
});

test("names the commit an image build passed in", () => {
  globals.__DISPATCH_COMMIT__ = "7cb1f229367c0d1e2f3a4b5c6d7e8f9a0b1c2d3e";
  expect(buildCommit()).toBe("7cb1f229367c0d1e2f3a4b5c6d7e8f9a0b1c2d3e");
});

test("names nothing when no commit was defined", () => {
  expect(buildCommit()).toBeUndefined();
});

test("names nothing for an empty or partial commit", () => {
  for (const commit of ["", "7cb1f22", "dev-build", "7CB1F229367C0D1E2F3A4B5C6D7E8F9A0B1C2D3E"]) {
    globals.__DISPATCH_COMMIT__ = commit;
    expect(buildCommit()).toBeUndefined();
  }
});
