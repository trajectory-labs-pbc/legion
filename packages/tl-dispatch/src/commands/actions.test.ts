import { describe, expect, test } from "bun:test";

import { defineActions } from "./actions";
import { createCatalog, runCommand } from "./schema";

const catalog = createCatalog([
  { name: "global", parent: null, scope: "global", commands: [] },
  {
    name: "issue",
    parent: "global",
    scope: "issue",
    commands: [
      { name: "open", label: "Open", keys: ["Enter"] },
      { name: "pin", label: "Pin issue", keys: ["Shift+P"] },
      { name: "copy-ref", label: "Copy reference" },
    ],
  },
]);

interface Issue {
  closed: boolean;
}

const ran: string[] = [];
const useIssueActions = defineActions(catalog, "issue", (issue: Issue) => ({
  open: { run: () => ran.push("open") },
  pin: { run: () => ran.push("pin"), enabled: !issue.closed },
  "copy-ref": { run: () => ran.push("copy-ref") },
}));

describe("actions", () => {
  test("every member is always present, gated or not", () => {
    expect(useIssueActions({ closed: true }).map((spec) => spec.command.name)).toEqual([
      "open",
      "pin",
      "copy-ref",
    ]);
  });

  test("a hook that leaves a command out, or adds one the catalog lacks, fails the type check and throws on its first call", () => {
    // @ts-expect-error: `pin` and `copy-ref` are missing, and `archive` is not in the catalog.
    const wrong = defineActions(catalog, "issue", (_r: null) => ({
      open: { run: () => {} },
      archive: { run: () => {} },
    }));
    expect(() => wrong(null)).toThrow("missing [pin, copy-ref], not in the catalog [archive]");
  });

  test("a shut gate stops the run on every surface", () => {
    ran.length = 0;
    const [open, pin] = useIssueActions({ closed: true });
    if (open === undefined || pin === undefined) throw new Error("the issue lost its commands");
    expect(runCommand(pin)).toBe(false);
    expect(runCommand(open)).toBe(true);
    expect(ran).toEqual(["open"]);
  });
});
