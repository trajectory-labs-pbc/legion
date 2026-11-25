import { describe, expect, it, vi } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

import { Button } from "#registry/legion/ui/button";
import { Dialog, DialogContent, DialogTitle } from "#registry/legion/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "#registry/legion/ui/dropdown-menu";

// Base UI marks the page inert around a modal popup; the count of marked elements tells modal from not.
async function inertAdded(ui: ReactElement, trigger: string, role: string): Promise<number> {
  render(ui);
  const before = document.querySelectorAll("[data-base-ui-inert]").length;
  await userEvent.click(screen.getByRole("button", { name: trigger }));
  await screen.findByRole(role, { name: "Popup" });
  const added = document.querySelectorAll("[data-base-ui-inert]").length - before;
  cleanup();
  return added;
}

function Menu({ modal }: { modal?: boolean }) {
  return (
    <DropdownMenu {...(modal === undefined ? {} : { modal })}>
      <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Popup">
        <DropdownMenuItem>One</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InDialog({ children }: { children: ReactElement }) {
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogTitle>Surface</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

describe("DropdownMenu", () => {
  it("opens on Enter, moves with the arrows, runs an item and returns the focus", async () => {
    const onArchive = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button />}>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onArchive}>Archive</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("menu");
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Rename"));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("Archive");
    await userEvent.keyboard("{Enter}");
    expect(onArchive).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" }));
  });

  it("keeps the menu open for a checkbox item and closes it for a radio item", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>View</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem>Show done</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup defaultValue="list">
            <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="board">Board</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const checkbox = await screen.findByRole("menuitemcheckbox", { name: "Show done" });
    checkbox.focus();
    await userEvent.keyboard("{Enter}");
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menu")).toBeDefined();
    screen.getByRole("menuitemradio", { name: "Board" }).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("closes on Escape", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>More</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>One</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    await screen.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("labels its groups, links an item and opens a submenu with ArrowRight", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Issue</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Go to</DropdownMenuLabel>
            <DropdownMenuLinkItem href="#history">
              History
              <DropdownMenuShortcut steps={[["G"], ["H"]]} />
            </DropdownMenuLinkItem>
          </DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Backlog</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const group = await screen.findByRole("group", { name: "Go to" });
    const link = screen.getByText("History").closest("a");
    expect(link?.getAttribute("href")).toBe("#history");
    expect([...(link?.querySelectorAll("kbd") ?? [])].map((key) => key.textContent)).toEqual([
      "G",
      "H",
    ]);
    expect(group.contains(link)).toBe(true);
    const subTrigger = screen.getByRole("menuitem", { name: "Move to" });
    subTrigger.focus();
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Backlog"));
    await userEvent.keyboard("{ArrowLeft}");
    await waitFor(() => expect(screen.queryByText("Backlog")).toBeNull());
    expect(document.activeElement).toBe(subTrigger);
  });

  it("is modal inside a dialog and not on the page", async () => {
    const onPage = await inertAdded(<Menu />, "Menu", "menu");
    expect(onPage).toBe(await inertAdded(<Menu modal={false} />, "Menu", "menu"));
    expect(onPage).not.toBe(await inertAdded(<Menu modal />, "Menu", "menu"));
    const inDialog = await inertAdded(
      <InDialog>
        <Menu />
      </InDialog>,
      "Menu",
      "menu"
    );
    expect(inDialog).toBe(
      await inertAdded(
        <InDialog>
          <Menu modal />
        </InDialog>,
        "Menu",
        "menu"
      )
    );
    expect(inDialog).not.toBe(
      await inertAdded(
        <InDialog>
          <Menu modal={false} />
        </InDialog>,
        "Menu",
        "menu"
      )
    );
  });

  it("keeps the menu open when a checkbox item is pressed with the pointer", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>View</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem>Show done</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem>Show archived</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Show done" }));
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Show archived" }));
    expect(screen.getByRole("menu")).toBeDefined();
    for (const name of ["Show done", "Show archived"])
      expect(screen.getByRole("menuitemcheckbox", { name }).getAttribute("aria-checked")).toBe(
        "true"
      );
  });
});
