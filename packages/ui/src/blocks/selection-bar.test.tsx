import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { SelectionBar } from "#registry/legion/blocks/selection-bar";

describe("SelectionBar", () => {
  it("sits over the bottom of its column, named by its count, with the actions at the right", () => {
    render(
      <SelectionBar count={3}>
        <button type="button">Snooze</button>
        <button type="button">Dismiss</button>
      </SelectionBar>
    );
    const bar = screen.getByRole("group", { name: "3 selected" });
    for (const name of ["absolute", "bottom-0", "inset-x-0", "h-11", "border-t"]) {
      expect(bar.className).toContain(name);
    }
    expect(bar.className).not.toContain("shadow-");
    expect(screen.getByRole("button", { name: "Snooze" }).parentElement?.className).toContain(
      "ml-auto"
    );
    expect(bar.textContent).toBe("3 selectedSnoozeDismiss");
  });

  it("shows its caller's message after the count, and no wrapper without one", () => {
    const { rerender } = render(
      <SelectionBar count={4} message="Could not snooze 1 of 4">
        <button type="button">Snooze</button>
      </SelectionBar>
    );
    expect(screen.getByRole("group").textContent).toBe("4 selectedCould not snooze 1 of 4Snooze");
    rerender(
      <SelectionBar count={4} message={null}>
        <button type="button">Snooze</button>
      </SelectionBar>
    );
    expect(screen.getByRole("group").children).toHaveLength(2);
  });
});
