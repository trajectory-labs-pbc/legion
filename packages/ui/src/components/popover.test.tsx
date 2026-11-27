import { describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";

import { Button } from "#registry/legion/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "#registry/legion/ui/popover";

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
});
