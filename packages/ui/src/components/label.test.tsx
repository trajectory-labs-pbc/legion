import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Checkbox } from "#registry/legion/ui/checkbox";
import { Label } from "#registry/legion/ui/label";

describe("Label", () => {
  it("names its control, and a press on it moves the focus there", async () => {
    render(
      <>
        <Label htmlFor="name">Name</Label>
        <input id="name" />
        <Label>
          <Checkbox /> Notify me
        </Label>
      </>
    );
    await userEvent.click(screen.getByText("Name"));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));
    expect(screen.getByRole("checkbox", { name: "Notify me" })).toBeDefined();
  });
});
