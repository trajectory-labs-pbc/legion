import { describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "#registry/legion/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#registry/legion/ui/drawer";

describe("Drawer", () => {
  it("opens on Enter, closes on Escape and from its close button", async () => {
    render(
      <Drawer>
        <DrawerTrigger render={<Button />}>Open drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filters</DrawerTitle>
            <DrawerDescription>Narrow the list.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>Body</DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    const drawer = await screen.findByRole("dialog", { name: "Filters" });
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open drawer" }));

    await userEvent.keyboard("{Enter}");
    const done = await screen.findByRole("button", { name: "Done" });
    done.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
