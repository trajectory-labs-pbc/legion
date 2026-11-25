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
});
