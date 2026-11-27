import { describe, expect, it, jest } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GroupHeader } from "#registry/legion/blocks/group-header";

describe("GroupHeader", () => {
  it("is one sticky 36 px line on the muted step: glyph, name, count, then the end", () => {
    const { container } = render(
      <GroupHeader
        count={4}
        end={<button type="button">Add</button>}
        glyph={<svg data-testid="glyph" />}
        onOpenChange={() => {}}
        open
        title="Needs you"
      />
    );
    const header = container.querySelector("[data-slot=group-header]");
    for (const name of ["h-list-row-1", "sticky", "top-0", "bg-muted"]) {
      expect(header?.className).toContain(name);
    }
    expect(header?.textContent).toBe("Needs you4Add");
    expect(screen.getByRole("button", { name: "Add" }).parentElement?.className).toContain(
      "ml-auto"
    );
    expect(
      screen.getByRole("button", { name: "Needs you 4" }).contains(screen.getByTestId("glyph"))
    ).toBe(true);
  });

  it("folds and unfolds its group through its caller", async () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(<GroupHeader onOpenChange={onOpenChange} open title="Later" />);
    const fold = screen.getByRole("button", { name: "Later" });
    expect(fold.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(fold);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    rerender(<GroupHeader onOpenChange={onOpenChange} open={false} title="Later" />);
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(fold);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });

  it("draws no count at zero and no wrapper for an empty slot", () => {
    const { container } = render(
      <GroupHeader count={0} end={null} glyph={false} onOpenChange={() => {}} open title="Low" />
    );
    expect(container.querySelector("[data-slot=group-header]")?.children).toHaveLength(1);
    expect(screen.getByRole("button").textContent).toBe("Low");
  });
});
