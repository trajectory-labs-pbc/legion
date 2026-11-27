import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Switch } from "#registry/legion/ui/switch";

describe("Switch", () => {
  it("toggles on Space and Enter", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Live" onCheckedChange={onCheckedChange} />);
    await userEvent.tab();
    const toggle = screen.getByRole("switch", { name: "Live" });
    expect(document.activeElement).toBe(toggle);
    await userEvent.keyboard(" ");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });
});
