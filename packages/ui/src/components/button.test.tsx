import { describe, expect, it, vi } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "#registry/legion/ui/button";

describe("Button", () => {
  it("presses on Enter and Space", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("keeps the focus but blocks the press while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>
    );
    await userEvent.tab();
    const button = screen.getByRole("button", { name: "Save" });
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("hovers a quiet-danger button on the danger tint, never the accent", () => {
    render(<Button variant="quiet-danger">Revoke</Button>);
    const tokens = screen.getByRole("button", { name: "Revoke" }).className.split(" ");
    expect(tokens).toContain("text-danger");
    expect(tokens).toContain("hover:bg-danger-tint");
    expect(tokens.filter((token) => token.includes("accent"))).toEqual([]);
  });

  it("leaves the tab order when disabled", async () => {
    render(
      <>
        <Button disabled>Off</Button>
        <Button>On</Button>
      </>
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "On" }));
  });
});
