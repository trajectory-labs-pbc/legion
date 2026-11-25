import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Count } from "#registry/legion/ui/count";

describe("Count", () => {
  it("is a muted tabular number, named by its title", () => {
    render(<Count title="4 unread replies" value={4} />);
    const count = screen.getByTitle("4 unread replies");
    expect(count.textContent).toBe("4");
    expect(count.className).toContain("text-muted-foreground");
    expect(count.className).toContain("tabular-nums");
    expect(count.className).not.toContain("warning");
  });

  it("draws nothing at zero", () => {
    const { container } = render(<Count value={0} />);
    expect(container.innerHTML).toBe("");
  });
});
