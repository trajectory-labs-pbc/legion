import { describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
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
});
