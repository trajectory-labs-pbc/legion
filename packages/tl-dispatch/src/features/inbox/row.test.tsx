import { describe, expect, jest, test } from "bun:test";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import type { InboxRowFacts } from "@/data/inbox/row";
import { mount } from "../../../tests/mount";
import { InboxRowView, RowSelectBox } from "./row";

const NOW = new Date("2026-11-20T12:00:00Z");
const base = {
  id: "row",
  at: new Date("2026-11-20T10:00:00Z"),
  // P0 is a level apart from High, so the bars show the urgency, not the priority.
  priority: { value: 0, label: "P0" },
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
  test("an ask shows its urgency bars, names the priority, and has no unread dot", () => {
    const { row } = draw(ASK);
    expect(row?.className).toContain("h-list-row-2");
    const bars = screen.getByRole("img", { name: "Urgency: High · P0" });
    expect(bars.getAttribute("data-level")).toBe("3");
    expect(screen.queryByRole("img", { name: "Unread" })).toBeNull();
  });

  test("the bars' tooltip names the urgency and the priority on hover", async () => {
    jest.useFakeTimers();
    try {
      draw(ASK);
      const trigger = screen.getByRole("img", { name: /^Urgency/ }).parentElement;
      if (trigger === null) throw new Error("the bars have no tooltip trigger");
      // userEvent waits on timers, so the pointer comes as plain events on the fake clock.
      fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      // The positioner places the popup in a microtask, which the async act waits for.
      await act(async () => {
        jest.advanceTimersByTime(600);
      });
      expect(screen.getByText("Urgency: High · P0")).toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });

  test("an ask in an urgency group draws no bars, since its group shows the urgency", () => {
    mount(
      <InboxRowView
        facts={ASK}
        now={NOW}
        preview="Preview"
        title="Ship the importer"
        urgencyShown={false}
      />
    );
    expect(screen.queryByRole("img", { name: /^Urgency/ })).toBeNull();
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

  test("an ask's title is at weight 500, line two holds the preview and the time", () => {
    draw(ASK);
    // The nearest element that sets the title's type: no part between sets another.
    let typed: HTMLElement | null = title();
    while (typed !== null && !/\b(font|text)-/.test(typed.className)) typed = typed.parentElement;
    expect(typed?.className).toContain("font-medium");
    expect(screen.getByText("Should the importer retry a failed batch?")).toBeDefined();
    expect(screen.getByText("2h").closest("time")?.getAttribute("datetime")).toBe(
      base.at.toISOString()
    );
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
        rowTitle="Ship the importer"
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
