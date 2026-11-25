import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { AttentionMark } from "#registry/legion/ui/attention-mark";

describe("AttentionMark", () => {
  it("is a warning dot and count with the label as its name", () => {
    render(<AttentionMark count={7} label="Waiting: 7" />);
    const mark = screen.getByRole("img", { name: "Waiting: 7" });
    expect(mark.textContent).toBe("7");
    expect(mark.className).toContain("text-warning");
    expect(mark.title).toBe("Waiting: 7");
    expect(mark.querySelector('[aria-hidden="true"]')?.className).toContain("bg-warning");
  });

  it("draws the dot alone without a count, a step larger in a header", () => {
    render(<AttentionMark label="Waiting" size="header" />);
    const mark = screen.getByRole("img", { name: "Waiting" });
    expect(mark.textContent).toBe("");
    expect(mark.className).toContain("text-sm");
    expect(mark.querySelector('[aria-hidden="true"]')?.className).toContain("size-2");
  });
});
