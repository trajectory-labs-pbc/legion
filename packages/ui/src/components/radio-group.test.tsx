import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Label } from "#registry/legion/ui/label";
import { RadioGroup, RadioGroupItem } from "#registry/legion/ui/radio-group";

describe("RadioGroup", () => {
  it("takes one tab stop and moves the choice with the arrows", async () => {
    const onValueChange = vi.fn();
    render(
      <>
        <RadioGroup aria-label="Size" defaultValue="s" onValueChange={onValueChange}>
          <Label>
            <RadioGroupItem value="s" /> Small
          </Label>
          <Label>
            <RadioGroupItem value="m" /> Medium
          </Label>
          <Label>
            <RadioGroupItem value="l" /> Large
          </Label>
        </RadioGroup>
        <button type="button">After</button>
      </>
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Small" }));
    await userEvent.keyboard("{ArrowDown}");
    const medium = screen.getByRole("radio", { name: "Medium" });
    expect(document.activeElement).toBe(medium);
    expect(medium.getAttribute("aria-checked")).toBe("true");
    expect(onValueChange).toHaveBeenCalledWith("m", expect.anything());
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  // happy-dom lays nothing out, so the classes stand for the box: 16 px, grown 4 px each way.
  it("takes the pointer across 24 px with a pseudo-element around each 16 px item", () => {
    render(
      <RadioGroup aria-label="Size">
        <RadioGroupItem aria-label="Small" value="s" />
      </RadioGroup>
    );
    const { classList } = screen.getByRole("radio", { name: "Small" });
    for (const name of ["relative", "size-4", "after:absolute", "after:-inset-1"]) {
      expect(classList.contains(name), name).toBe(true);
    }
  });
});
