import { expect, test } from "bun:test";

import { formatMachineCode } from "./format-machine-code";

test.each([
  ["", ""],
  ["wxyz", "WXYZ"],
  ["wxyz4", "WXYZ-4"],
  ["wxyz4321", "WXYZ-4321"],
  ["WXYZ-4321", "WXYZ-4321"],
  [" wx yz-43_21 ", "WXYZ-4321"],
  ["wxyz43210000", "WXYZ-4321"],
])("formats %p as %p", (typed, shown) => {
  expect(formatMachineCode(typed)).toBe(shown);
});
