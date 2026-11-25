import { describe, expect, it } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useRef } from "react";

import { Button } from "#registry/legion/ui/button";
import { Dialog, DialogContent, DialogTitle } from "#registry/legion/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "#registry/legion/ui/popover";

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

function Pop({ modal }: { modal?: boolean }) {
  return (
    <Popover {...(modal === undefined ? {} : { modal })}>
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

describe("Popover", () => {
  it("opens on Enter, closes on Escape and returns the focus", async () => {
    render(
      <Popover>
        <PopoverTrigger render={<Button />}>Filter</PopoverTrigger>
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>Filters</PopoverTitle>
            <PopoverDescription>Narrow the list.</PopoverDescription>
          </PopoverHeader>
          <input aria-label="Text" />
        </PopoverContent>
      </Popover>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const popup = await screen.findByRole("dialog", { name: "Filters" });
    expect(screen.getByRole("heading", { name: "Filters", level: 2 })).toBeDefined();
    await waitFor(() => expect(popup.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Filter" }));
  });

  it("opens against an anchor other than its trigger", async () => {
    function Anchored() {
      const anchor = useRef<HTMLDivElement>(null);
      return (
        <>
          <div ref={anchor} data-testid="anchor" />
          <Popover>
            <PopoverTrigger render={<Button />}>Assign</PopoverTrigger>
            <PopoverContent anchor={anchor}>
              <PopoverTitle>Assignee</PopoverTitle>
            </PopoverContent>
          </Popover>
        </>
      );
    }
    render(<Anchored />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Assignee" })).toBeDefined();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("is modal inside a dialog and not on the page", async () => {
    const onPage = await inertAdded(<Pop />, "Filter", "dialog");
    expect(onPage).toBe(await inertAdded(<Pop modal={false} />, "Filter", "dialog"));
    expect(onPage).not.toBe(await inertAdded(<Pop modal />, "Filter", "dialog"));
    const inDialog = await inertAdded(
      <InDialog>
        <Pop />
      </InDialog>,
      "Filter",
      "dialog"
    );
    expect(inDialog).toBe(
      await inertAdded(
        <InDialog>
          <Pop modal />
        </InDialog>,
        "Filter",
        "dialog"
      )
    );
    expect(inDialog).not.toBe(
      await inertAdded(
        <InDialog>
          <Pop modal={false} />
        </InDialog>,
        "Filter",
        "dialog"
      )
    );
  });
});
