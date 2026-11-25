import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Count } from "#registry/legion/ui/count";

describe("Count", () => {
  it("is a muted number, and the warning mark only when it needs the reader", () => {
    render(
      <>
        <Count value={4} />
        <Count needsYou value={7} />
      </>
    );
    const muted = screen.getByText("4");
    expect(muted.className).toContain("text-muted-foreground");
    expect(muted.className).not.toContain("warning");
    expect(muted.hasAttribute("data-needs-you")).toBe(false);
    const mark = screen.getByText("7");
    expect(mark.className).toContain("text-warning");
    expect(mark.hasAttribute("data-needs-you")).toBe(true);
  });

  it("draws nothing at zero", () => {
    const { container } = render(<Count needsYou value={0} />);
    expect(container.innerHTML).toBe("");
  });
});
