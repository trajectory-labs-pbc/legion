import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { KeyTooltip } from "#registry/legion/ui/key-tooltip";

describe("KeyTooltip", () => {
  it("names the focused control and shows its key, and gives the control its aria keys", async () => {
    render(
      <KeyTooltip
        trigger={<button type="button">Search</button>}
        label="Search and actions"
        chips={["Ctrl+K"]}
        ariaKeyShortcuts="Control+K"
      />
    );
    const control = screen.getByRole("button", { name: "Search" });
    expect(control.getAttribute("aria-keyshortcuts")).toBe("Control+K");
    await userEvent.tab();
    const tooltip = await screen.findByText("Search and actions");
    expect(tooltip.parentElement?.querySelector("kbd")?.textContent).toBe("Ctrl+K");
  });

  it("shows the label alone when the control has no key", async () => {
    render(
      <KeyTooltip trigger={<button type="button">Pin</button>} label="Pin issue" chips={null} />
    );
    await userEvent.tab();
    const tooltip = await screen.findByText("Pin issue");
    expect(tooltip.parentElement?.querySelector("kbd")).toBeNull();
  });
});
