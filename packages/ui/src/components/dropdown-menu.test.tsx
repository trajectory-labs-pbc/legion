import { afterEach, describe, expect, it, vi } from "bun:test";
import { compile } from "@tailwindcss/node";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "#registry/legion/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "#registry/legion/ui/context-menu";
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

/** Opens a dropdown menu holding `rows`. */
function openMenu(rows: ReactNode): void {
  render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>Issue</DropdownMenuTrigger>
      <DropdownMenuContent>{rows}</DropdownMenuContent>
    </DropdownMenu>
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
    openMenu(
      <>
        <DropdownMenuCheckboxItem>Show done</DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup defaultValue="list">
          <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="board">Board</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </>
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
    openMenu(
      <>
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
      </>
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
    openMenu(
      <>
        <DropdownMenuCheckboxItem>Show done</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Show archived</DropdownMenuCheckboxItem>
      </>
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

/** Expects each row named in `want` in the open menu to keep an icon's room or not, as `want` says. */
async function expectRoom(want: Record<string, boolean>): Promise<void> {
  const found = await Promise.all(
    Object.keys(want).map(async (name) => [name, await screen.findByText(name)] as const)
  );
  loadDrawnCss();
  expect(Object.fromEntries(found.map(([name, node]) => [name, keepsIconRoom(node)]))).toEqual(
    want
  );
}

/** The computed style of an element that must exist. */
function styleOf(node: Element | null | undefined, what: string): CSSStyleDeclaration {
  if (node == null) throw new Error(`no ${what}`);
  return getComputedStyle(node);
}

/** Which separators the open menu draws, by test id. */
async function drawnSeparators(): Promise<(string | undefined)[]> {
  await screen.findByRole("menu");
  loadDrawnCss();
  return screen
    .getAllByRole("separator", { hidden: true })
    .filter((separator) => getComputedStyle(separator).display !== "none")
    .map((separator) => separator.dataset.testid);
}

describe("DropdownMenu's drawn rows", () => {
  it("draws a separator only between rows: none first, none last, one where two meet", async () => {
    openMenu(
      <>
        <DropdownMenuSeparator data-testid="first-1" />
        <DropdownMenuSeparator data-testid="first-2" />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Copy</DropdownMenuLabel>
          <DropdownMenuItem>Link</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator data-testid="after-group" />
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuSeparator data-testid="pair-1" />
        <DropdownMenuSeparator data-testid="pair-2" />
        <DropdownMenuItem>Archive</DropdownMenuItem>
        <DropdownMenuSeparator data-testid="before-group" />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move</DropdownMenuLabel>
          <DropdownMenuItem>Backlog</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator data-testid="last" />
      </>
    );
    expect(await drawnSeparators()).toEqual(["after-group", "pair-2", "before-group"]);
  });

  it.each([
    ["a row", <DropdownMenuItem key="row">Rename</DropdownMenuItem>],
    [
      "a group",
      <DropdownMenuGroup key="group">
        <DropdownMenuLabel>Move</DropdownMenuLabel>
        <DropdownMenuItem>Backlog</DropdownMenuItem>
      </DropdownMenuGroup>,
    ],
  ])("draws no separator first, even right before %s", async (_, next) => {
    openMenu(
      <>
        <DropdownMenuSeparator data-testid="first" />
        {next}
        <DropdownMenuItem>Archive</DropdownMenuItem>
      </>
    );
    expect(await drawnSeparators()).toEqual([]);
  });

  it("draws a separator after a checkbox row as after any row", async () => {
    openMenu(
      <>
        <DropdownMenuCheckboxItem>Show done</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator data-testid="after-checkbox" />
        <DropdownMenuItem>Rename</DropdownMenuItem>
      </>
    );
    expect(await drawnSeparators()).toEqual(["after-checkbox"]);
  });

  it("gives every other row and each label the room when a row marks its icon inline-start, and none in its open submenu", async () => {
    openMenu(
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
          <DropdownMenuRadioItem value="board">Board</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuLinkItem href="#help">
          <CopyIcon aria-hidden data-icon="inline-start" />
          Help
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem href="#docs">Docs</DropdownMenuLinkItem>
        <DropdownMenuItem>
          Open
          <CopyIcon aria-hidden data-icon="inline-end" />
        </DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CopyIcon aria-hidden data-icon="inline-start" />
            Copy as
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Markdown</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub defaultOpen>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Backlog</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </>
    );
    await expectRoom({
      "Copy link": false,
      "Assign to me": false,
      Wrapped: false,
      List: false,
      Board: true,
      Help: false,
      Docs: true,
      Open: true,
      Rename: true,
      Move: true,
      "Copy as": false,
      "Move to": true,
      Backlog: false,
    });
  });

  it("gives the room for a mark on any element, not only an icon", async () => {
    openMenu(
      <>
        <DropdownMenuItem>
          <span data-icon="inline-start" />
          Assign to me
        </DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
      </>
    );
    await expectRoom({ "Assign to me": false, Rename: true });
  });

  it("keeps no room in a menu whose rows mark no icon, though its open submenu marks one", async () => {
    openMenu(
      <>
        <DropdownMenuItem>
          <CopyIcon aria-hidden />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuGroup>
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuRadioGroup value="list">
            <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuLinkItem href="#docs">Docs</DropdownMenuLinkItem>
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
    await expectRoom({
      "Copy link": false,
      Rename: false,
      View: false,
      List: false,
      Docs: false,
      "Move to": false,
      Backlog: false,
      Done: true,
    });
  });

  it("keeps no room in a menu whose only icon is marked inline-end", async () => {
    openMenu(
      <>
        <DropdownMenuItem>
          Open
          <CopyIcon aria-hidden data-icon="inline-end" />
        </DropdownMenuItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
      </>
    );
    await expectRoom({ Open: false, Rename: false });
  });

  it("gives a context menu's plain row the room when another row marks its icon", async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Row</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            <CopyIcon aria-hidden data-icon="inline-start" />
            Copy link
          </ContextMenuItem>
          <ContextMenuItem>Rename</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    fireEvent.contextMenu(screen.getByText("Row"));
    await expectRoom({ "Copy link": false, Rename: true });
  });

  it.each([
    true,
    false,
  ])("keeps the room on a checkbox row, checked: %p, for its check, and on every row and label beside it", async (checked) => {
    openMenu(
      <>
        <DropdownMenuCheckboxItem checked={checked}>Show done</DropdownMenuCheckboxItem>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuGroup>
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuRadioGroup value="list">
            <DropdownMenuRadioItem value="board">Board</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuLinkItem href="#docs">Docs</DropdownMenuLinkItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Backlog</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </>
    );
    await expectRoom({
      "Show done": true,
      Rename: true,
      View: true,
      Board: true,
      Docs: true,
      "Move to": true,
    });
  });

  it("keeps a checkbox row's room for its check when the row holds a marked icon", async () => {
    openMenu(
      <DropdownMenuCheckboxItem>
        <CopyIcon aria-hidden data-icon="inline-start" />
        Show copies
      </DropdownMenuCheckboxItem>
    );
    await expectRoom({ "Show copies": true });
  });

  it("places a checkbox row's check at its start, a radio row's at its end, and a shortcut and a chevron at the row's end", async () => {
    openMenu(
      <>
        <DropdownMenuCheckboxItem checked>Show done</DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup value="list">
          <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuItem>
          Rename
          <DropdownMenuShortcut steps={[["R"]]} />
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Backlog</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </>
    );
    const checkbox = await screen.findByRole("menuitemcheckbox", { name: "Show done" });
    const radio = screen.getByRole("menuitemradio", { name: "List" });
    const rename = screen.getByText("Rename");
    const moveTo = screen.getByRole("menuitem", { name: "Move to" });
    loadDrawnCss();
    const checkboxRow = styleOf(checkbox, "checkbox row");
    const checkboxCheck = styleOf(checkbox.firstElementChild, "checkbox check");
    const radioCheck = styleOf(radio.firstElementChild, "radio check");
    const radioRow = styleOf(radio, "radio row");
    expect({
      checkboxRow: checkboxRow.position,
      checkboxCheck: [
        checkboxCheck.position,
        checkboxCheck.insetInlineStart,
        checkboxCheck.insetInlineEnd,
      ],
      radioCheck: [radioCheck.position, radioCheck.insetInlineStart, radioCheck.insetInlineEnd],
      radioRow: [radioRow.position, radioRow.paddingInlineEnd],
      shortcutStart: styleOf(rename.querySelector('[data-slot="kbd-sequence"]'), "shortcut")
        .marginInlineStart,
      chevronStart: styleOf(moveTo.lastElementChild, "chevron").marginInlineStart,
    }).toEqual({
      checkboxRow: "relative",
      checkboxCheck: ["absolute", "calc(4px * 2)", ""],
      radioCheck: ["absolute", "", "calc(4px * 2)"],
      radioRow: ["relative", "calc(4px * 8)"],
      shortcutStart: "auto",
      chevronStart: "auto",
    });
  });
});
