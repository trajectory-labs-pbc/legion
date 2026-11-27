import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GroupHeader } from "#registry/legion/blocks/group-header";
import { Collapsible, CollapsibleContent } from "#registry/legion/ui/collapsible";

describe("GroupHeader", () => {
  it("is one sticky 36 px line on the muted step: glyph, name, count, then the end", () => {
    const { container } = render(
      <Collapsible defaultOpen>
        <GroupHeader
          count={4}
          end={<button type="button">Add</button>}
          glyph={<svg data-testid="glyph" />}
          title="Needs you"
        />
      </Collapsible>
    );
    const header = container.querySelector("[data-slot=group-header]");
    for (const name of ["h-list-row-1", "sticky", "top-0"]) {
      expect(header?.className).toContain(name);
    }
    expect(header?.textContent).toBe("Needs you4Add");
    expect(
      screen.getByRole("button", { name: "Needs you 4" }).contains(screen.getByTestId("glyph"))
    ).toBe(true);
  });

  it("folds and unfolds the group of the Collapsible it sits in", async () => {
    render(
      <Collapsible defaultOpen>
        <GroupHeader title="Later" />
        <CollapsibleContent>Row</CollapsibleContent>
      </Collapsible>
    );
    const fold = screen.getByRole("button", { name: "Later" });
    expect(fold.getAttribute("aria-expanded")).toBe("true");
    expect(fold.getAttribute("aria-controls")).toBe(screen.getByText("Row").id);
    await userEvent.click(fold);
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(fold);
    expect(fold.getAttribute("aria-expanded")).toBe("true");
  });

  it("draws no count at zero and no wrapper for an empty slot", () => {
    const { container } = render(
      <Collapsible>
        <GroupHeader count={0} end={null} glyph={false} title="Low" />
      </Collapsible>
    );
    expect(container.querySelector("[data-slot=group-header]")?.children).toHaveLength(1);
    expect(screen.getByRole("button").textContent).toBe("Low");
  });
});
