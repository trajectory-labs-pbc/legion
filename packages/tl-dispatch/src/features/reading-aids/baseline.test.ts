import { describe, expect, test } from "bun:test";

import { approvalAsk, at } from "./approval-asks.fixture";
import { baselineOf, baselineText, textChangedSince } from "./baseline";

const SPEC = "spec-id";
const VERIFICATION = "verification-id";

describe("baselineOf", () => {
  test("an open request on the document compares with the version approved before it", () => {
    expect(baselineOf([approvalAsk(at(SPEC, 12), { approved: 8 })], SPEC, 12)).toEqual({
      kind: "approved",
      version: 8,
    });
  });

  test("a request that names the document only in its list falls back to the read mark", () => {
    const ask = approvalAsk(at(VERIFICATION, 3), {
      approved: 2,
      documents: [at(VERIFICATION, 3), at(SPEC, 12)],
    });
    expect(baselineOf([ask], SPEC, 4)).toEqual({ kind: "read", version: 4 });
  });

  test("never-approved: a request with no approved version falls back to the read mark", () => {
    expect(baselineOf([approvalAsk(at(SPEC, 12))], SPEC, 4)).toEqual({ kind: "read", version: 4 });
  });

  test("no request compares with the read mark, and neither gives none", () => {
    expect(baselineOf([], SPEC, 4)).toEqual({ kind: "read", version: 4 });
    expect(baselineOf([], SPEC, null)).toBeNull();
  });

  test("an answered request gives no baseline", () => {
    const answered = approvalAsk(at(SPEC, 12), { approved: 8, state: "answered" });
    expect(baselineOf([answered], SPEC, null)).toBeNull();
  });

  test("a spec's request gives its verification no marks with no read mark", () => {
    const ask = approvalAsk(at(SPEC, 12), {
      approved: 8,
      documents: [at(SPEC, 12), at(VERIFICATION, 3)],
    });
    expect(baselineOf([ask], VERIFICATION, null)).toBeNull();
  });
});

describe("textChangedSince", () => {
  test("v16: the page's own entry moved past the version the request named", () => {
    const ask = approvalAsk(at(SPEC, 16, 15), { documents: [at(SPEC, 16, 15)] });
    expect(textChangedSince([ask], SPEC)).toBe(15);
  });

  test("moved-verification: only the verification's page says so", () => {
    const ask = approvalAsk(at(SPEC, 15), {
      documents: [at(SPEC, 15), at(VERIFICATION, 4, 3)],
    });
    expect(textChangedSince([ask], VERIFICATION)).toBe(3);
    expect(textChangedSince([ask], SPEC)).toBeUndefined();
  });

  test("old-server line: a request with no list reads its lead fields", () => {
    expect(textChangedSince([approvalAsk(at(SPEC, 16, 15))], SPEC)).toBe(15);
    expect(textChangedSince([approvalAsk(at(SPEC, 16, 15))], VERIFICATION)).toBeUndefined();
  });

  test("an unmoved document says nothing", () => {
    expect(
      textChangedSince([approvalAsk(at(SPEC, 15), { documents: [at(SPEC, 15)] })], SPEC)
    ).toBeUndefined();
  });
});

test("baselineText names the baseline by its kind", () => {
  expect(baselineText({ kind: "approved", version: 8 })).toBe(
    "Since v8, the last approved version"
  );
  expect(baselineText({ kind: "read", version: 4 })).toBe("Since v4, the version you last read");
  expect(baselineText({ kind: "chosen", version: 6 })).toBe("Since v6");
});
