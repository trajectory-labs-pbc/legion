import { describe, expect, it, vi } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#registry/legion/ui/alert-dialog";
import { Button } from "#registry/legion/ui/button";

describe("AlertDialog", () => {
  it("opens on Enter, cancels on Escape and returns the focus", async () => {
    const onDelete = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" />}>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the issue?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const dialog = await screen.findByRole("alertdialog", { name: "Delete the issue?" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("closes from Cancel by keyboard", async () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>Leave?</AlertDialogTitle>
          <AlertDialogCancel>Stay</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    );
    const cancel = await screen.findByRole("button", { name: "Stay" });
    cancel.focus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("opens with the focus on Cancel, wherever Cancel sits and whatever ref it is given", async () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>Archive the issue?</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogAction>Archive</AlertDialogAction>
            <AlertDialogCancel ref={ref}>Keep</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
    const keep = await screen.findByRole("button", { name: "Keep" });
    await waitFor(() => expect(document.activeElement).toBe(keep));
    expect(ref.current?.isSameNode(keep)).toBe(true);
  });

  it("closes after its action runs, unless the action prevents it", async () => {
    const onArchive = vi.fn();
    const { unmount } = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>Archive the issue?</AlertDialogTitle>
          <AlertDialogAction onClick={onArchive}>Archive</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    );
    screen.getByRole("button", { name: "Archive" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onArchive).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    unmount();

    const onOpenChange = vi.fn();
    render(
      <AlertDialog defaultOpen onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogTitle>Archive the issue?</AlertDialogTitle>
          <AlertDialogAction onClick={(event) => event.preventDefault()}>Archive</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    );
    screen.getByRole("button", { name: "Archive" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Archive the issue?" })).toBeDefined();
  });
});
