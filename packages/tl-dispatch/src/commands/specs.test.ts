import { describe, expect, test } from "bun:test";

import { createCatalog } from "./catalog";
import { defineActions, runCommand } from "./specs";

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
const useIssueActions = defineActions(catalog, "issue", (issue: Issue, _options: null) => ({
  open: { run: () => ran.push("open") },
  pin: { run: () => ran.push("pin"), enabled: !issue.closed },
  "copy-ref": { run: () => ran.push("copy-ref") },
}));

describe("actions", () => {
  test("every member is always present, gated or not", () => {
    expect(useIssueActions({ closed: true }, null).list.map((spec) => spec.command.name)).toEqual([
      "open",
      "pin",
      "copy-ref",
    ]);
  });

  test("a hook that leaves a command out, or adds one the catalog lacks, fails the type check and throws on its first call", () => {
    // @ts-expect-error: `pin` and `copy-ref` are missing, and `archive` is not in the catalog.
    const wrong = defineActions(catalog, "issue", (_r: null, _o: null) => ({
      open: { run: () => {} },
      archive: { run: () => {} },
    }));
    expect(() => wrong(null, null)).toThrow(
      "missing [pin, copy-ref], not in the catalog [archive]"
    );
  });

  test("a shut gate stops the run on every surface", () => {
    ran.length = 0;
    const specs = useIssueActions({ closed: true }, null);
    expect(runCommand(specs.get("pin"))).toBe(false);
    expect(runCommand(specs.get("open"))).toBe(true);
    expect(ran).toEqual(["open"]);
  });
});
