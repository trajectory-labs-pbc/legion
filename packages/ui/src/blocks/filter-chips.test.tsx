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
  });

  it("removes its filter through its caller, named apart from another filter on its field", async () => {
    const onRemove = jest.fn();
    render(
      <>
        <FilterChip field="Project" onRemove={onRemove} operator="is" value="Web" />
        <FilterChip field="Project" onRemove={() => {}} operator="is not" value="Web" />
      </>
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove the filter Project is Web" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Remove the filter Project is not Web" })
    ).toBeDefined();
  });
});

describe("FilterChips", () => {
  it("draws its children in order, then the end at the right", () => {
    const { container } = render(
      <FilterChips end={<button type="button">Mark all read</button>}>
        <input aria-label="Search" />
        <FilterChip field="Type" onRemove={() => {}} operator="is" value="Reply" />
      </FilterChips>
    );
    const row = container.querySelector("[data-slot=filter-chips]");
    expect(row?.firstElementChild).toBe(screen.getByRole("textbox", { name: "Search" }));
    expect(row?.lastElementChild?.textContent).toBe("Mark all read");
  });

  it("draws no wrapper when nothing is at the end", () => {
    const { container } = render(
      <FilterChips end={null}>
        <input aria-label="Search" />
      </FilterChips>
    );
    expect(container.querySelector("[data-slot=filter-chips]")?.children).toHaveLength(1);
  });
});
