import { describe, expect, it } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactElement } from "react";

import { Button } from "#registry/legion/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "#registry/legion/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#registry/legion/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "#registry/legion/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "#registry/legion/ui/sheet";

// Base UI stacks the overlays: these check what the package's parts rely on.

type Modal = { modal?: boolean };
const modalProp = ({ modal }: Modal) => (modal === undefined ? {} : { modal });

function Menu(props: Modal) {
  return (
    <DropdownMenu {...modalProp(props)}>
      <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Popup">
        <DropdownMenuItem>One</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pop(props: Modal) {
  return (
    <Popover {...modalProp(props)}>
      <PopoverTrigger>Filter</PopoverTrigger>
      <PopoverContent>
        <PopoverTitle>Popup</PopoverTitle>
      </PopoverContent>
    </Popover>
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

const POPUPS: readonly (readonly [string, ComponentType<Modal>, string, string])[] = [
  ["a menu", Menu, "Menu", "menu"],
  ["a popover", Pop, "Filter", "dialog"],
];

describe.each(POPUPS)("%s", (_name, Popup, trigger, role) => {
  it("is modal inside a dialog and not on the page", async () => {
    const added = (ui: ReactElement) => inertAdded(ui, trigger, role);
    const onPage = await added(<Popup />);
    expect(onPage).toBe(await added(<Popup modal={false} />));
    expect(onPage).not.toBe(await added(<Popup modal />));
    const inDialog = await added(
      <InDialog>
        <Popup />
      </InDialog>
    );
    expect(inDialog).toBe(
      await added(
        <InDialog>
          <Popup modal />
        </InDialog>
      )
    );
    expect(inDialog).not.toBe(
      await added(
        <InDialog>
          <Popup modal={false} />
        </InDialog>
      )
    );
  });
});

function DialogInSheet() {
  return (
    <Sheet defaultOpen>
      <SheetContent>
        <SheetTitle>Sheet</SheetTitle>
        <p>Sheet body</p>
        <Dialog>
          <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

const scrims = () =>
  document.querySelectorAll("[data-slot=sheet-overlay], [data-slot=dialog-overlay]");

async function openDialogInSheet(): Promise<HTMLElement> {
  render(<DialogInSheet />);
  const sheet = await screen.findByRole("dialog", { name: "Sheet" });
  await userEvent.click(screen.getByRole("button", { name: "Open dialog" }));
  await screen.findByRole("dialog", { name: "Dialog" });
  return sheet;
}

describe("Nested overlays", () => {
  it("show one scrim and dim the sheet under a dialog", async () => {
    const sheet = await openDialogInSheet();
    expect(scrims().length).toBe(1);
    await waitFor(() => expect(sheet.hasAttribute("data-nested-dialog-open")).toBe(true));
  });

  it("close only the top layer on Escape", async () => {
    const sheet = await openDialogInSheet();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Dialog" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Sheet" })).toBe(sheet);
    await waitFor(() => expect(sheet.hasAttribute("data-nested-dialog-open")).toBe(false));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("close only the top layer on a press outside it", async () => {
    await openDialogInSheet();
    const viewport = document.querySelector<HTMLElement>("[data-slot=dialog-viewport]");
    if (viewport === null) throw new Error("no dialog viewport");
    await userEvent.click(viewport);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Dialog" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Sheet" })).toBeDefined();
  });

  it("close a menu in a dialog on Escape or a press outside it, and leave the dialog open", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Dialog</DialogTitle>
          <p>Dialog body</p>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button />}>Menu</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>One</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogContent>
      </Dialog>
    );
    const trigger = await screen.findByRole("button", { name: "Menu" });
    await userEvent.click(trigger);
    await screen.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.getByRole("dialog", { name: "Dialog" })).toBeDefined();

    await userEvent.click(trigger);
    await screen.findByRole("menu");
    await userEvent.click(screen.getByText("Dialog body"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.getByRole("dialog", { name: "Dialog" })).toBeDefined();
  });
});
