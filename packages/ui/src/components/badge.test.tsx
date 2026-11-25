import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Badge } from "#registry/legion/ui/badge";

describe("Badge", () => {
  it("renders its state variant and takes no focus", async () => {
    render(
      <>
        <Badge variant="warning">Waiting</Badge>
        <button type="button">After</button>
      </>
    );
    expect(screen.getByText("Waiting").className).toContain("text-warning");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it("holds a count in a 20 px chip at least as wide, in tabular figures", () => {
    render(
      <Badge size="count" variant="warning">
        7
      </Badge>
    );
    const tokens = screen.getByText("7").className.split(" ");
    for (const token of ["h-5", "min-w-5", "px-1", "tabular-nums"]) expect(tokens).toContain(token);
    expect(tokens).not.toContain("py-0.5");
  });

  it("renders as a link that takes the keyboard", async () => {
    render(<Badge render={<a href="#issue">Open</a>} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Open" }));
  });
});
