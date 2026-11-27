import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Textarea } from "#registry/legion/ui/textarea";

describe("Textarea", () => {
  it("takes the focus and keeps new lines from Enter", async () => {
    render(<Textarea aria-label="Comment" />);
    const textarea = screen.getByRole("textbox", { name: "Comment" });
    await userEvent.tab();
    expect(document.activeElement).toBe(textarea);
    await userEvent.keyboard("one{Enter}two");
    expect((textarea as HTMLTextAreaElement).value).toBe("one\ntwo");
  });

  it("types 16 px text on a coarse pointer, at any width", () => {
    render(<Textarea aria-label="Comment" />);
    const field = screen.getByRole("textbox", { name: "Comment" });
    const classes = [...field.classList];
    expect(classes).toEqual(expect.arrayContaining(["text-sm", "pointer-coarse:text-base"]));
    expect(classes.filter((name) => /^(sm|md|lg|xl|2xl):text-/.test(name))).toEqual([]);
  });
});
