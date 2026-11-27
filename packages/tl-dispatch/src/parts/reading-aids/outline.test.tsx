import { afterEach, expect, test } from "bun:test";

import { render } from "../../../tests/react";
import { type Outline, OutlineNav } from "./outline";
import type { OutlineEntry } from "./outline-entries";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const entryOf = (level: number, text: string, changes = 0, decisions = 0): OutlineEntry => ({
  blockId: text,
  changes,
  decisions,
  level,
  text,
});

function draw(entries: OutlineEntry[]): HTMLButtonElement[] {
  const outline: Outline = { actions: {}, entries, marked: 0, moveTo: () => {}, shown: true };
  const view = render(<OutlineNav outline={outline} />);
  cleanups.push(view.unmount);
  return [...view.container.querySelectorAll("button")];
}

test("an entry is indented by its level below the outline's top level, and its title is its text", () => {
  const buttons = draw([entryOf(2, "Design"), entryOf(3, "Parts"), entryOf(2, "Later")]);
  const indents = buttons.map(
    (button) => button.firstElementChild?.className.match(/\bms-\d+\b/)?.[0] ?? ""
  );
  expect(indents).toEqual(["", "ms-3", ""]);
  expect(buttons.map((button) => button.title)).toEqual(["Design", "Parts", "Later"]);
});

test("an entry's counts read as what they count, one in the singular, and a zero reads as nothing", () => {
  const [changed, both, decided, none] = draw([
    entryOf(1, "Title", 2, 0),
    entryOf(2, "Design", 1, 1),
    entryOf(2, "Parts", 0, 3),
    entryOf(2, "Later"),
  ]);
  const names = [changed, both, decided, none].map((button) => button?.getAttribute("aria-label"));
  expect(names).toEqual([
    "Title, 2 changes",
    "Design, 1 change, 1 open decision",
    "Parts, 3 open decisions",
    "Later",
  ]);
  // What shows: the heading's text, then a short label that names what each number counts.
  expect([changed, both, decided, none].map((button) => button?.textContent)).toEqual([
    "Title2 changes",
    "Design1 change · 1 open",
    "Parts3 open",
    "Later",
  ]);
});

test("a shown count stops at 99+, and the entry's name keeps the whole number", () => {
  const [big] = draw([entryOf(1, "Big", 120, 100)]);
  expect(big?.textContent).toBe("Big99+ changes · 99+ open");
  expect(big?.getAttribute("aria-label")).toBe("Big, 120 changes, 100 open decisions");
});
