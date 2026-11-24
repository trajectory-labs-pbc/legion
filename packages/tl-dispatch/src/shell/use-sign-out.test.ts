import { describe, expect, test } from "bun:test";

import { unsentLabels } from "./use-sign-out";

describe("unsentLabels", () => {
  test("lists each change once, this tab's label first", () => {
    expect(
      unsentLabels(
        [
          { key: "a", label: "Reply to AB-1" },
          { key: "b", label: "Edit AB-2" },
        ],
        [
          { key: "a", label: "Reply to AB-1 (other tab)" },
          { key: "c", label: "Close AB-3" },
        ]
      )
    ).toEqual(["Reply to AB-1", "Edit AB-2", "Close AB-3"]);
    expect(unsentLabels([], [])).toEqual([]);
  });
});
