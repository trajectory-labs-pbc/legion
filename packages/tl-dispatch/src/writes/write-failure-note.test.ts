import { expect, test } from "bun:test";
import { SendStoppedError } from "@/upstream/writes";

import { writeFailureNote } from "./write-failure-note";

const failure = {
  what: "the approval",
  anew: "Pressing Approve again sends a new approval.",
  refused: (error: unknown) => `refused: ${(error as Error).message}`,
};

test("a stopped write may have been made, and says what the control sends now", () => {
  expect(writeFailureNote(new SendStoppedError(), failure)).toBe(
    "Dispatch has not confirmed the approval: it may have been made. Pressing Approve again sends a new approval."
  );
});

test("any other failure says what the surface gives for it", () => {
  expect(writeFailureNote(new Error("no"), failure)).toBe("refused: no");
});
