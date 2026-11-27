import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Toggle } from "#registry/legion/ui/toggle";

describe("Toggle", () => {
  it("presses on Space and Enter", async () => {
    render(<Toggle aria-label="Bold">B</Toggle>);
    await userEvent.tab();
    const toggle = screen.getByRole("button", { name: "Bold" });
    expect(document.activeElement).toBe(toggle);
    await userEvent.keyboard(" ");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });
});
