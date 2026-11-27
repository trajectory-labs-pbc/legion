import { describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "#registry/legion/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#registry/legion/ui/dialog";

function Example() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Edit</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit issue</DialogTitle>
          <DialogDescription>Change the title.</DialogDescription>
        </DialogHeader>
        <input aria-label="Title" />
        <DialogFooter>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("opens on Enter, closes on Escape and returns the focus", async () => {
    render(<Example />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "Edit issue" });
    expect(screen.getByRole("heading", { name: "Edit issue", level: 2 })).toBeDefined();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }));
  });

  it("closes from its labelled close button", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const close = await screen.findByRole("button", { name: "Close" });
    close.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
