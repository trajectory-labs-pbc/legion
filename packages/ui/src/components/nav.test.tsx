import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "#registry/legion/ui/button";
import { NavRow, NavSurface } from "#registry/legion/ui/nav";

describe("NavRow", () => {
  it("is a link that takes the keyboard, and marks the open page", async () => {
    render(
      <NavSurface aria-label="Navigation">
        <NavRow href="#inbox" aria-current="page">
          Inbox
        </NavRow>
        <NavRow href="#agents">Agents</NavRow>
      </NavSurface>
    );
    expect(screen.getByRole("complementary", { name: "Navigation" })).toBeDefined();
    const inbox = screen.getByRole("link", { name: "Inbox" });
    expect(inbox.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Agents" }).hasAttribute("aria-current")).toBe(false);
    await userEvent.tab();
    expect(document.activeElement).toBe(inbox);
  });

  it("draws as the element it is given, with its own props", () => {
    render(
      <NavSurface render={<nav aria-label="Pins" />}>
        <NavRow render={<button type="button" />}>Open</NavRow>
      </NavSurface>
    );
    expect(screen.getByRole("navigation", { name: "Pins" }).getAttribute("data-slot")).toBe(
      "nav-surface"
    );
    expect(screen.getByRole("button", { name: "Open" }).getAttribute("data-slot")).toBe("nav-row");
  });

  it("draws hover a half step under the current row, and keeps the current label's weight", () => {
    render(<NavRow href="#inbox">Inbox</NavRow>);
    const tokens = screen.getByRole("link", { name: "Inbox" }).className.split(" ");
    expect(tokens).toContain("hover:bg-sidebar-accent/50");
    expect(tokens).toContain("aria-[current=page]:bg-sidebar-accent");
    expect(tokens.filter((token) => token.includes("font-"))).toEqual([]);
  });

  it("gives a ghost button on the surface the rows' hover on the button itself, not the surface", () => {
    render(
      <NavSurface aria-label="Navigation">
        <Button variant="ghost">Search</Button>
      </NavSurface>
    );
    const surface = screen.getByRole("complementary", { name: "Navigation" }).className.split(" ");
    expect(surface.filter((token) => token.includes("hover:"))).toEqual([]);
    const button = screen.getByRole("button", { name: "Search" }).className.split(" ");
    for (const hover of ["bg-sidebar-accent/50", "text-sidebar-accent-foreground"]) {
      expect(button).toContain(`in-data-[slot=nav-surface]:hover:${hover}`);
    }
  });
});
