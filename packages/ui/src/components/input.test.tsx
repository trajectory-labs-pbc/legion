import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Input } from "#registry/legion/ui/input";
import { Label } from "#registry/legion/ui/label";

describe("Input", () => {
  it("takes the focus and the typing, and its label names it", async () => {
    render(
      <>
        <Label htmlFor="title">Title</Label>
        <Input id="title" aria-invalid />
      </>
    );
    const input = screen.getByRole("textbox", { name: "Title" });
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard("Fix the build");
    expect((input as HTMLInputElement).value).toBe("Fix the build");
  });

  it("types 16 px text on a coarse pointer, at any width", () => {
    render(<Input aria-label="Title" />);
    const field = screen.getByRole("textbox", { name: "Title" });
    const classes = [...field.classList];
    expect(classes).toEqual(expect.arrayContaining(["text-sm", "pointer-coarse:text-base"]));
    expect(classes.filter((name) => /^(sm|md|lg|xl|2xl):text-/.test(name))).toEqual([]);
  });
});
