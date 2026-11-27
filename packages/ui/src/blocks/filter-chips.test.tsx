import { describe, expect, it, jest } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FilterChip, FilterChips } from "#registry/legion/blocks/filter-chips";

describe("FilterChip", () => {
  it("reads field, operator, value, then its remove control", () => {
    const { container } = render(
      <FilterChip field="Project" onRemove={() => {}} operator="is" value="Web" />
    );
    const chip = container.querySelector("[data-slot=filter-chip]");
    expect([...(chip?.children ?? [])].map((part) => part.textContent)).toEqual([
      "Project",
      "is",
      "Web",
      "",
    ]);
    expect(chip?.className).toContain("rounded-badge");
  });

  it("removes its filter through its caller", async () => {
    const onRemove = jest.fn();
    render(<FilterChip field="Project" onRemove={onRemove} operator="is" value="Web" />);
    await userEvent.click(screen.getByRole("button", { name: "Remove the Project filter" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("FilterChips", () => {
  it("draws the start, the chips with what follows them, then the end at the right", () => {
    const { container } = render(
      <FilterChips
        end={<button type="button">Mark all read</button>}
        start={<input aria-label="Search" />}
      >
        <FilterChip field="Type" onRemove={() => {}} operator="is" value="Reply" />
        <button type="button">Clear filters</button>
      </FilterChips>
    );
    const row = container.querySelector("[data-slot=filter-chips]");
    expect(row?.firstElementChild).toBe(screen.getByRole("textbox", { name: "Search" }));
    const chips = row?.children[1];
    expect(chips?.lastElementChild).toBe(screen.getByRole("button", { name: "Clear filters" }));
    expect(
      screen.getByRole("button", { name: "Mark all read" }).parentElement?.className
    ).toContain("ml-auto");
  });

  it("draws no wrapper when no filter is set and nothing is at the end", () => {
    const { container } = render(
      <FilterChips end={null} start={<input aria-label="Search" />}>
        {false}
      </FilterChips>
    );
    expect(container.querySelector("[data-slot=filter-chips]")?.children).toHaveLength(1);
  });
});
