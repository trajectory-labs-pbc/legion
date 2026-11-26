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

  it("hovers an outline or ghost button on the secondary step; the accent is a menu's and a navigation's", () => {
    render(
      <>
        <Button variant="outline">Look up</Button>
        <Button variant="ghost">Sign out</Button>
      </>
    );
    for (const name of ["Look up", "Sign out"]) {
      const tokens = screen.getByRole("button", { name }).className.split(" ");
      expect(tokens).toContain("hover:bg-secondary");
      const accents = tokens.filter((token) => token.includes("accent"));
      expect(accents.filter((token) => !token.startsWith("in-data-[slot=nav-surface]:"))).toEqual(
        []
      );
    }
  });

  it("draws a link with no side padding, so its text lines up with the text around it", () => {
    render(
      <Button size="sm" variant="link">
        How it works
      </Button>
    );
    const tokens = screen.getByRole("button", { name: "How it works" }).className.split(" ");
    expect(tokens).toContain("px-0");
    expect(tokens.filter((token) => /^px-(?!0$)/.test(token))).toEqual([]);
  });

  it("takes a little padding on the side of an icon marked inline-start or inline-end", () => {
    render(
      <>
        <Button>
          <svg aria-hidden data-icon="inline-start" />
          Add
        </Button>
        <Button size="xs">
          Projects
          <svg aria-hidden data-icon="inline-end" />
        </Button>
      </>
    );
    const add = screen.getByRole("button", { name: "Add" }).className.split(" ");
    expect(add).toContain("has-data-[icon=inline-start]:pl-2.5");
    const fold = screen.getByRole("button", { name: "Projects" }).className.split(" ");
    expect(fold).toContain("has-data-[icon=inline-end]:pr-1.5");
  });

  it("keeps its name while loading, with the spinner first, in the start icon's place", () => {
    render(
      <>
        <Button loading>
          <svg aria-hidden data-icon="inline-start" />
          Save
        </Button>
        <Button loading>Retry</Button>
      </>
    );
    for (const name of ["Save", "Retry"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("data-loading")).toBe("true");
      expect(button.firstElementChild?.getAttribute("data-slot")).toBe("spinner");
    }
    const tokens = screen.getByRole("button", { name: "Save" }).className.split(" ");
    expect(tokens).toContain("data-loading:[&>[data-icon=inline-start]]:hidden");
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
