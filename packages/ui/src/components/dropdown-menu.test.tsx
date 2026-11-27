import { afterEach, describe, expect, it, vi } from "bun:test";
import { compile } from "@tailwindcss/node";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "#registry/legion/ui/button";
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

// These rules are CSS alone, so the tests load the CSS Tailwind generates for the classes the menu
// draws and read the computed style. The spacing is inline: happy-dom ignores the theme's layer.
const tailwind = await compile(
  '@theme inline { --spacing: 4px; }\n@import "tailwindcss/utilities";',
  {
    base: import.meta.dirname,
    onDependency: () => {},
  }
);

afterEach(() => {
  for (const style of document.head.querySelectorAll("style[data-test-css]")) style.remove();
});

/** Loads the CSS for every class now in the document. */
function loadDrawnCss(): void {
  const classes = [...document.querySelectorAll("[class]")].flatMap((node) => [...node.classList]);
  const style = document.createElement("style");
  style.dataset.testCss = "";
  style.textContent = tailwind.build(classes);
  document.head.append(style);
}

/** Whether a row's text starts after an icon's room: 8 + 16 + 8 px, which `ps-8` gives. */
const keepsIconRoom = (node: Element) =>
  getComputedStyle(node).paddingInlineStart === "calc(4px * 8)";

/** Opens a menu holding `rows`, and says which of the rows named in `names` keep an icon's room. */
async function roomOf(rows: ReactNode, names: readonly string[]): Promise<boolean[]> {
  render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>Issue</DropdownMenuTrigger>
      <DropdownMenuContent>{rows}</DropdownMenuContent>
    </DropdownMenu>
  );
  const found = await Promise.all(names.map((name) => screen.findByText(name)));
  loadDrawnCss();
  return found.map(keepsIconRoom);
}

describe("DropdownMenu's drawn rows", () => {
  it("draws a separator only between rows: none first, none last, one where two meet", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Issue</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSeparator data-testid="first" />
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuSeparator data-testid="pair-1" />
          <DropdownMenuSeparator data-testid="pair-2" />
          <DropdownMenuItem>Archive</DropdownMenuItem>
          <DropdownMenuSeparator data-testid="before-group" />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Copy</DropdownMenuLabel>
            <DropdownMenuItem>Link</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator data-testid="last" />
        </DropdownMenuContent>
      </DropdownMenu>
    );
    await screen.findByRole("menu");
    loadDrawnCss();
    const drawn = screen
      .getAllByRole("separator", { hidden: true })
      .filter((separator) => getComputedStyle(separator).display !== "none")
      .map((separator) => separator.dataset.testid);
    expect(drawn).toEqual(["pair-2", "before-group"]);
  });

  it("gives every other row and each label the room when a row marks its icon inline-start, and none in its open submenu", async () => {
    const rows = (
      <>
        <DropdownMenuItem>
          <CopyIcon aria-hidden data-icon="inline-start" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem>
          <span data-icon="inline-start" />
          Assign to me
        </DropdownMenuItem>
        <DropdownMenuItem>
          <span>
            <CopyIcon aria-hidden data-icon="inline-start" />
          </span>
          Wrapped
        </DropdownMenuItem>
        <DropdownMenuRadioGroup value="list">
          <DropdownMenuRadioItem value="list">
            <CopyIcon aria-hidden data-icon="inline-start" />
            List
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSub defaultOpen>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Backlog</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </>
    );
    expect(
      await roomOf(rows, [
        "Copy link",
        "Assign to me",
        "Wrapped",
        "List",
        "Rename",
        "Move",
        "Move to",
        "Backlog",
      ])
    ).toEqual([false, false, false, false, true, true, true, false]);
  });

  it("keeps no room in a menu whose rows mark no icon, though its open submenu marks one", async () => {
    const rows = (
      <>
        <DropdownMenuItem>
          <CopyIcon aria-hidden />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuSub defaultOpen>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>
              <CopyIcon aria-hidden data-icon="inline-start" />
              Backlog
            </DropdownMenuItem>
            <DropdownMenuItem>Done</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </>
    );
    expect(await roomOf(rows, ["Copy link", "Rename", "Move to", "Backlog", "Done"])).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("keeps the room on a checkbox row, for its check, and on every row beside it", async () => {
    const rows = (
      <>
        <DropdownMenuCheckboxItem>Show done</DropdownMenuCheckboxItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
      </>
    );
    expect(await roomOf(rows, ["Show done", "Rename"])).toEqual([true, true]);
  });

  it("keeps a checkbox row's room for its check when the row holds a marked icon", async () => {
    const rows = (
      <DropdownMenuCheckboxItem>
        <CopyIcon aria-hidden data-icon="inline-start" />
        Show copies
      </DropdownMenuCheckboxItem>
    );
    expect(await roomOf(rows, ["Show copies"])).toEqual([true]);
  });
});
