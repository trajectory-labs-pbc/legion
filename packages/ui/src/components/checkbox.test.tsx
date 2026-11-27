import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Checkbox } from "#registry/legion/ui/checkbox";

// The 24 px square on the control's centre that takes the pointer (PT2).
const BAND = [
  "after:absolute",
  "after:top-1/2",
  "after:left-1/2",
  "after:size-6",
  "after:-translate-1/2",
];

describe("Checkbox", () => {
  it("toggles on Space", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Done" onCheckedChange={onCheckedChange} />);
    await userEvent.tab();
    const box = screen.getByRole("checkbox", { name: "Done" });
    expect(document.activeElement).toBe(box);
    await userEvent.keyboard(" ");
    expect(box.getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard(" ");
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it("shows a mixed state", () => {
    render(<Checkbox aria-label="Some" indeterminate />);
    expect(screen.getByRole("checkbox", { name: "Some" }).getAttribute("aria-checked")).toBe(
      "mixed"
    );
  });

  // happy-dom lays nothing out, so the classes stand for the target: a 24 px square on the
  // centre, which the 1 px border does not shrink. Base UI renders a span with no display of its
  // own: inline, it would draw 2 px wide, so the box is an inline flex with its mark centred.
  it("takes the pointer across a 24 px square around its 16 px box", () => {
    render(<Checkbox aria-label="Done" />);
    const box = screen.getByRole("checkbox", { name: "Done" });
    expect(box.className.split(" ")).toEqual(
      expect.arrayContaining([...BAND, "inline-flex", "size-4", "items-center", "justify-center"])
    );
  });
});
