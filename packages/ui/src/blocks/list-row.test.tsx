import { describe, expect, it, jest } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";

import { ListRow } from "#registry/legion/blocks/list-row";

const rowOf = (container: HTMLElement) => {
  const row = container.querySelector("[data-slot=list-row]");
  if (!(row instanceof HTMLElement)) throw new Error("no row");
  return row;
};

describe("ListRow", () => {
  it("is one 36 px line with its end at the right", () => {
    const { container } = render(<ListRow end={<span>3h</span>} title="One line" />);
    expect(rowOf(container).className).toContain("h-list-row-1");
    expect(rowOf(container).textContent).toBe("One line3h");
  });

  it("is two 56 px lines, each with its own end", () => {
    const { container } = render(
      <ListRow
        description="Line two"
        descriptionEnd={<span>replied</span>}
        end={<time>3h</time>}
        title="Line one"
      />
    );
    expect(rowOf(container).className).toContain("h-list-row-2");
    expect(screen.getByText("Line one").parentElement?.contains(screen.getByText("3h"))).toBe(true);
    expect(screen.getByText("Line two").parentElement?.contains(screen.getByText("replied"))).toBe(
      true
    );
  });

  it("takes its caller's marks, as an option too", () => {
    const { container } = render(
      <ListRow aria-selected data-highlighted="" data-selected="" role="option" title="Title" />
    );
    const row = screen.getByRole("option", { selected: true });
    expect(row).toBe(rowOf(container));
    expect(row.hasAttribute("data-highlighted")).toBe(true);
    expect(row.hasAttribute("data-selected")).toBe(true);
  });

  it("shows the box in the leading part's place near the left edge, and on each row of a selection", () => {
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
    expect(box?.className).toContain("group-hover/list-row-start:visible");
    expect(avatar?.className).toContain("group-hover/list-row-start:invisible");
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

  it("keeps the box's click and keys from the content it renders", () => {
    const onLink = jest.fn();
    render(
      <ListRow
        // biome-ignore lint/a11y/useAnchorContent: the row gives the link its content
        render={<a href="#x" />}
        select={<input aria-label="Select" type="checkbox" />}
        title="Title"
      />
    );
    const box = screen.getByRole("checkbox");
    const link = screen.getByRole("link");
    link.addEventListener("click", onLink);
    link.addEventListener("keydown", onLink);
    expect(link.contains(box)).toBe(false);
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.keyDown(box, { key: "x" });
    expect(onLink).not.toHaveBeenCalled();
    expect(window.location.hash).not.toBe("#x");
    expect(box.closest("[data-slot=list-row-select]")).not.toBeNull();
  });

  it("renders its content as the element its caller gives", () => {
    const onOpen = jest.fn();
    render(<ListRow render={<button onClick={onOpen} type="button" />} title="Title" />);
    const content = screen.getByRole("button");
    expect(content.getAttribute("data-slot")).toBe("list-row-content");
    fireEvent.click(screen.getByText("Title"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
