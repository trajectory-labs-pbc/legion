import { describe, expect, it, jest } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";

import { ListRow } from "#registry/legion/blocks/list-row";

const rowOf = (container: HTMLElement) => {
  const row = container.querySelector("[data-slot=list-row]");
  if (!(row instanceof HTMLElement)) throw new Error("no row");
  return row;
};

describe("ListRow", () => {
  it("is one 36 px line with no second line", () => {
    const { container } = render(<ListRow end={<span>3h</span>} title="One line" />);
    const row = rowOf(container);
    expect(row.className).toContain("h-list-row-1");
    expect(row.textContent).toBe("One line3h");
  });

  it("is two 56 px lines with the end at the right of line two", () => {
    const { container } = render(
      <ListRow description="Line two" end={<time>3h</time>} title="Line one" />
    );
    const row = rowOf(container);
    expect(row.className).toContain("h-list-row-2");
    const two = screen.getByText("Line two").parentElement;
    expect(two?.contains(screen.getByText("3h"))).toBe(true);
    expect(screen.getByText("Line one").className).toContain("font-medium");
    expect(screen.getByText("Line one").className).toContain("truncate");
    expect(screen.getByText("Line two").className).toContain("text-muted-foreground");
  });

  it("draws no edge, card or left stripe around it", () => {
    const { container } = render(<ListRow description="Two" title="One" />);
    const classes = [...container.querySelectorAll("[class]")].flatMap((part) =>
      (part.getAttribute("class") ?? "").split(" ")
    );
    expect(classes.filter((name) => /^(border|shadow-|rounded|ring)/.test(name))).toEqual([]);
  });

  it("puts a named dot before the title", () => {
    render(<ListRow dot="Unread" title="Title" />);
    const dot = screen.getByRole("img", { name: "Unread" });
    expect(dot.nextElementSibling?.textContent).toBe("Title");
  });

  it("marks the highlight and the selection, and draws focus inside the row", () => {
    const { container } = render(<ListRow highlighted selected title="Title" />);
    const row = rowOf(container);
    expect(row.hasAttribute("data-highlighted")).toBe(true);
    expect(row.hasAttribute("data-selected")).toBe(true);
    expect(row.className).toContain("data-highlighted:bg-secondary");
    expect(row.className).toContain("data-selected:bg-muted");
    expect(row.className).toContain("focus-visible:-outline-offset-2");
  });

  it("shows the box in the leading part's place on hover and focus, and on each row of a selection", () => {
    const { container, rerender } = render(
      <ListRow
        leading={<span data-testid="avatar" />}
        select={<input aria-label="Select" type="checkbox" />}
        title="Title"
      />
    );
    const box = screen.getByRole("checkbox").parentElement;
    const avatar = screen.getByTestId("avatar").parentElement;
    expect(box?.parentElement).toBe(avatar?.parentElement ?? null);
    expect(box?.className).toContain("invisible");
    expect(box?.className).toContain("group-hover/list-row:visible");
    expect(box?.className).toContain("group-focus-within/list-row:visible");
    expect(avatar?.className).toContain("group-hover/list-row:invisible");
    expect(rowOf(container).hasAttribute("data-selecting")).toBe(false);
    rerender(
      <ListRow
        leading={<span data-testid="avatar" />}
        select={<input aria-label="Select" type="checkbox" />}
        selecting
        title="Title"
      />
    );
    expect(rowOf(container).hasAttribute("data-selecting")).toBe(true);
    expect(box?.className).toContain("group-data-selecting/list-row:visible");
  });

  it("keeps a click on the box from the row, and passes the row's own click", () => {
    const onRow = jest.fn();
    const onBox = jest.fn();
    render(
      <ListRow
        onClick={onRow}
        select={<input aria-label="Select" onClick={onBox} type="checkbox" />}
        title="Title"
      />
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onBox).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Title"));
    expect(onRow).toHaveBeenCalledTimes(1);
  });

  it("draws as the element its caller renders", () => {
    render(<ListRow render={<button type="button" />} title="Title" />);
    expect(screen.getByRole("button").getAttribute("data-slot")).toBe("list-row");
  });
});
