import { describe, expect, it, jest } from "bun:test";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "#registry/legion/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#registry/legion/ui/tooltip";

describe("Tooltip", () => {
  it("shows when its trigger takes the focus and hides on Escape", async () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<Button size="icon" aria-label="Copy" />} />
          <TooltipContent>Copy the link</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Copy" }));
    await screen.findByText("Copy the link");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Copy the link")).toBeNull());
  });

  it("shows on hover after half a second", async () => {
    jest.useFakeTimers();
    try {
      render(
        <Tooltip>
          <TooltipTrigger render={<Button size="icon" aria-label="Copy" />} />
          <TooltipContent>Copy the link</TooltipContent>
        </Tooltip>
      );
      // userEvent waits on timers, so the pointer comes as plain events on the fake clock.
      const button = screen.getByRole("button", { name: "Copy" });
      fireEvent.pointerEnter(button, { pointerType: "mouse" });
      fireEvent.mouseEnter(button);
      fireEvent.mouseMove(button);
      act(() => jest.advanceTimersByTime(450));
      expect(screen.queryByText("Copy the link")).toBeNull();
      act(() => jest.advanceTimersByTime(100));
      expect(screen.queryByText("Copy the link")).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
