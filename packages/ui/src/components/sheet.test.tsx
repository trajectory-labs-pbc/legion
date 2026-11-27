import { describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "#registry/legion/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "#registry/legion/ui/sheet";

describe("Sheet", () => {
  it("opens on Enter from its side, closes on Escape and returns the focus", async () => {
    render(
      <Sheet>
        <SheetTrigger render={<Button />}>Details</SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Issue details</SheetTitle>
            <SheetDescription>Everything about it.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const sheet = await screen.findByRole("dialog", { name: "Issue details" });
    expect(sheet.getAttribute("data-side")).toBe("left");
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Details" }));
  });

  it("closes from its labelled close button", async () => {
    render(
      <Sheet defaultOpen>
        <SheetContent closeLabel="Dismiss">
          <SheetTitle>Panel</SheetTitle>
        </SheetContent>
      </Sheet>
    );
    const close = await screen.findByRole("button", { name: "Dismiss" });
    close.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes from a button in its footer", async () => {
    render(
      <Sheet defaultOpen>
        <SheetContent showCloseButton={false}>
          <SheetTitle>Filters</SheetTitle>
          <SheetFooter>
            <SheetClose render={<Button />}>Done</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
    const done = await screen.findByRole("button", { name: "Done" });
    expect(done.closest("[data-slot=sheet-footer]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    done.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
