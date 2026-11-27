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

  it("renders as a link that takes the keyboard", async () => {
    render(<Badge render={<a href="#issue">Open</a>} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Open" }));
  });
});
