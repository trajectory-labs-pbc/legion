import { describe, expect, test } from "bun:test";

import { createCatalog } from "./catalog";
import { defineActions, menuGroups, runCommand, visibility } from "./specs";

const catalog = createCatalog([
  { name: "global", parent: null, scope: "global", commands: [] },
  {
    name: "issue",
    parent: "global",
    scope: "issue",
    commands: [
      { name: "open", label: "Open", keys: ["Enter"], group: "open" },
      { name: "priority", label: "Set priority", keys: ["p"], group: "change", picker: true },
      { name: "pin", label: "Pin issue", keys: ["Shift+P"], group: "change" },
      { name: "copy-ref", label: "Copy reference", group: "copy" },
      { name: "delete", label: "Delete issue", group: "destructive", destructive: true },
    ],
  },
]);

interface Issue {
  closed: boolean;
  title: string;
}

const ran: string[] = [];
const useIssueActions = defineActions(catalog, "issue", (issue: Issue, _options: null) => ({
  open: { run: () => ran.push("open") },
  priority: { run: () => ran.push("priority"), enabled: !issue.closed },
  pin: { run: () => ran.push("pin"), subject: issue.title },
  "copy-ref": { run: () => ran.push("copy-ref") },
  delete: { run: () => ran.push("delete"), enabled: !issue.closed },
}));

describe("actions", () => {
  test("every member is always present, gated or not", () => {
    expect(Object.keys(useIssueActions({ closed: true, title: "A" }, null))).toHaveLength(5);
  });

  test("a hook that leaves a command out, or adds one the catalog lacks, throws", () => {
    const incomplete = defineActions(catalog, "issue", (_r: null, _o: null) => ({
      open: { run: () => {} },
    }));
    expect(() => incomplete(null, null)).toThrow("missing [priority, pin, copy-ref, delete]");
  });

  test("a shut gate stops the run on every surface", () => {
    ran.length = 0;
    const specs = useIssueActions({ closed: true, title: "A" }, null);
    expect(runCommand(specs.priority)).toBe(false);
    expect(runCommand(specs.pin)).toBe(true);
    expect(ran).toEqual(["pin"]);
  });
});

describe("showing a shut command", () => {
  const specs = useIssueActions({ closed: true, title: "A" }, null);
  test("a primary button and a key hint hide; a menu row greys; a destructive row hides", () => {
    expect(visibility(specs.priority, "primary-button")).toBe("hide");
    expect(visibility(specs.priority, "key-hint")).toBe("hide");
    expect(visibility(specs.priority, "menu-row")).toBe("greyed");
    expect(visibility(specs.delete, "menu-row")).toBe("hide");
  });
});

describe("a record menu", () => {
  test("lists the sections in their order and leaves empty ones out", () => {
    const open = menuGroups(useIssueActions({ closed: false, title: "A" }, null));
    expect(open.map((group) => group.section)).toEqual(["open", "change", "copy", "destructive"]);
    const closed = menuGroups(useIssueActions({ closed: true, title: "A" }, null));
    expect(closed.map((group) => group.section)).toEqual(["open", "change", "copy"]);
  });

  test("a picker is a submenu; a greyed row shows no key", () => {
    const [, change] = menuGroups(useIssueActions({ closed: true, title: "A" }, null));
    expect(
      change?.items.map((item) => [item.spec.command.name, item.submenu, item.greyed, item.hint])
    ).toEqual([
      ["priority", true, true, undefined],
      ["pin", false, false, "Shift+P"],
    ]);
  });

  test("with nothing to show, there are no groups and the trigger hides", () => {
    const empty = createCatalog([
      { name: "global", parent: null, scope: "global", commands: [] },
      {
        name: "doc",
        parent: "global",
        scope: "document",
        commands: [{ name: "delete", label: "Delete", group: "destructive", destructive: true }],
      },
    ]);
    const actions = defineActions(empty, "doc", (_r: null, _o: null) => ({
      delete: { run: () => {}, enabled: false },
    }));
    expect(menuGroups(actions(null, null))).toEqual([]);
  });
});
