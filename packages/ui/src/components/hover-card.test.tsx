import { describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "#registry/legion/ui/hover-card";

describe("HoverCard", () => {
  it("opens when its link takes the focus and closes on Escape", async () => {
    render(
      <HoverCard>
        <HoverCardTrigger href="#person" delay={0}>
          Ada
        </HoverCardTrigger>
        <HoverCardContent>Ada wrote this.</HoverCardContent>
      </HoverCard>
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Ada" }));
    await screen.findByText("Ada wrote this.");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Ada wrote this.")).toBeNull());
  });
});
