import { describe, expect, it } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  filterShortcuts,
  type ShortcutSection,
  ShortcutsSheet,
} from "#registry/legion/blocks/shortcuts-sheet";

const SECTIONS: readonly ShortcutSection[] = [
  {
    id: "general",
    label: "General",
    rows: [
      { id: "search", label: "Search and actions", keys: [["Ctrl+K"]] },
      { id: "next", label: "Next row", keys: [["J"], ["↓"]] },
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    rows: [{ id: "inbox", label: "Go to Inbox", keys: [["G", "I"]] }],
  },
];

const sheet = (sections = SECTIONS) =>
  render(
    <ShortcutsSheet
      open
      onOpenChange={() => {}}
      sections={sections}
      description="The keys that work here"
    />
  );

describe("ShortcutsSheet", () => {
  it("lists each section's rows with every key, a chord as one chip per step", async () => {
    sheet();
    const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(dialog).getByText("The keys that work here")).toBeDefined();
    const headings = within(dialog)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["General", "Navigation"]);
    const rows = within(dialog)
      .getAllByRole("listitem")
      .map((row) => [...row.querySelectorAll("kbd")].map((chip) => chip.textContent).join(" "));
    expect(rows).toEqual(["Ctrl+K", "J ↓", "G I"]);
    expect(within(dialog).getByText("or")).toBeDefined();
  });

  it("scrolls its list inside the sheet: the list can shrink below its content", async () => {
    sheet();
    const dialog = await screen.findByRole("dialog");
    const list = dialog.querySelector('[data-slot="shortcuts-list"]');
    expect(list?.className.split(" ")).toEqual(
      expect.arrayContaining(["min-h-0", "flex-1", "overflow-y-auto"])
    );
  });

  it("narrows to the rows that match the filter, and says when none does", async () => {
    sheet();
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Filter shortcuts"), "inbox");
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(1);
    await userEvent.type(within(dialog).getByLabelText("Filter shortcuts"), "zzz");
    expect(within(dialog).queryAllByRole("listitem")).toHaveLength(0);
    expect(within(dialog).getByText("No shortcut matches “inboxzzz”.")).toBeDefined();
  });

  it("says so when no key works", async () => {
    sheet([]);
    expect(await screen.findByText("No key works here.")).toBeDefined();
  });
});

describe("filterShortcuts", () => {
  it("matches a label in any case and drops a section left empty", () => {
    expect(filterShortcuts(SECTIONS, "  GO to ").map((section) => section.id)).toEqual([
      "navigation",
    ]);
    expect(filterShortcuts(SECTIONS, "")).toEqual([...SECTIONS]);
  });
});
