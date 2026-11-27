import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Label } from "#registry/legion/ui/label";
import { RadioGroup, RadioGroupItem } from "#registry/legion/ui/radio-group";

// The 24 px square on the control's centre that takes the pointer (PT2).
const BAND = [
  "after:absolute",
  "after:top-1/2",
  "after:left-1/2",
  "after:size-6",
  "after:-translate-x-1/2",
  "after:-translate-y-1/2",
];

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

  // happy-dom lays nothing out, so the classes stand for the target: a 24 px square on the
  // centre, which the 1 px border does not shrink.
  it("takes the pointer across a 24 px square around each 16 px item", () => {
    render(
      <RadioGroup aria-label="Size">
        <RadioGroupItem aria-label="Small" value="s" />
      </RadioGroup>
    );
    const item = screen.getByRole("radio", { name: "Small" });
    expect(item.className.split(" ")).toEqual(expect.arrayContaining(BAND));
  });
});
