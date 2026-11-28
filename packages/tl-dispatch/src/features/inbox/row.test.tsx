import { describe, expect, test } from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import type { InboxRowFacts } from "@/data/inbox/row";
import { mount } from "../../../tests/mount";
import { InboxRowView, RowSelectBox } from "./row";

const NOW = new Date("2026-11-20T12:00:00Z");
const base = {
  id: "row",
  at: new Date("2026-11-20T10:00:00Z"),
  priority: 1,
} as const;
const ASK: InboxRowFacts = {
  ...base,
  kind: "ask",
  type: "question",
  kindLabel: "Question",
  actor: { agent: true },
  urgency: { value: "high", label: "High" },
};
const thread = (unread: boolean): InboxRowFacts => ({
  ...base,
  kind: "thread",
  type: "reply",
  kindLabel: "Reply",
  actor: { agent: false, id: "ana@example.com" },
  unread,
});

function draw(facts: InboxRowFacts, select?: ReactNode) {
  const view = mount(
    <InboxRowView
      facts={facts}
      now={NOW}
      owner="CORE-12"
      preview="Should the importer retry a failed batch?"
      select={select}
      title="Ship the importer"
    />
  );
  return {
    row: document.querySelector<HTMLElement>('[data-slot="list-row"]'),
    unmount: view.unmount,
  };
}

const title = () => screen.getByText("Ship the importer");

describe("a row of the Inbox", () => {
  test("an ask shows its urgency bars, names the priority, and has no unread dot", async () => {
    const { row } = draw(ASK);
    expect(row?.className).toContain("h-list-row-2");
    const bars = screen.getByRole("img", { name: "Urgency: High, priority P1" });
    expect(bars.getAttribute("data-level")).toBe("3");
    expect(screen.queryByRole("img", { name: "Unread" })).toBeNull();
    await userEvent.hover(bars);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Urgency: High, priority P1");
  });

  test("an unread thread has the dot before its title, and a read one has none", () => {
    const unread = draw(thread(true));
    const dot = screen.getByRole("img", { name: "Unread" });
    expect(dot.compareDocumentPosition(title()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("img", { name: /^Urgency/ })).toBeNull();
    unread.unmount();
    draw(thread(false));
    expect(screen.queryByRole("img", { name: "Unread" })).toBeNull();
  });

  test("the title is at weight 500, line two holds the preview and the time", () => {
    draw(thread(false));
    expect(title().closest('[class*="font-medium"]')).not.toBeNull();
    expect(screen.getByText("Should the importer retry a failed batch?")).toBeDefined();
    expect(screen.getByText("2h").tagName).toBe("TIME");
  });

  test("the avatar shows the kind as a badge: the agent glyph for an agent, initials for a person", () => {
    const ask = draw(ASK);
    expect(screen.getByRole("img", { name: "Question" })).toBeDefined();
    expect(screen.queryByText("A")).toBeNull();
    ask.unmount();
    draw(thread(false));
    expect(screen.getByRole("img", { name: "Reply" })).toBeDefined();
    expect(screen.getByText("A")).toBeDefined();
  });

  test("the selection box sits in the avatar's place, and a click marks the row", async () => {
    let marked = false;
    const { row } = draw(
      ASK,
      <RowSelectBox
        name="Ship the importer"
        onCheckedChange={(checked) => {
          marked = checked;
        }}
      />
    );
    const box = screen.getByRole("checkbox", { name: "Select Ship the importer" });
    expect(box.closest('[data-slot="list-row-select"]')).not.toBeNull();
    expect(row?.contains(box)).toBe(true);
    await userEvent.click(box);
    expect(marked).toBe(true);
  });
});
