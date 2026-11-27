import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Checkbox } from "#registry/legion/ui/checkbox";

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

  // happy-dom lays nothing out, so the classes stand for the box: 16 px, grown 4 px each way.
  it("takes the pointer across 24 px with a pseudo-element around its 16 px box", () => {
    render(<Checkbox aria-label="Done" />);
    const { classList } = screen.getByRole("checkbox", { name: "Done" });
    for (const name of ["relative", "size-4", "after:absolute", "after:-inset-1"]) {
      expect(classList.contains(name), name).toBe(true);
    }
  });
});
