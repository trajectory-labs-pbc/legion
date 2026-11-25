import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
});
