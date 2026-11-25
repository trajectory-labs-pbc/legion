import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { AttentionMark } from "#registry/legion/ui/attention-mark";

describe("AttentionMark", () => {
  it("is a square warning chip holding the count, with the label as its name", () => {
    render(<AttentionMark count={7} label="Waiting: 7" />);
    const mark = screen.getByRole("img", { name: "Waiting: 7" });
    expect(mark.textContent).toBe("7");
    expect(mark.title).toBe("Waiting: 7");
    for (const token of ["bg-warning-tint", "border-warning-border", "text-warning", "h-5"]) {
      expect(mark.className).toContain(token);
    }
  });

  it("holds a square without a count, a step larger in a header", () => {
    render(<AttentionMark label="Waiting" size="header" />);
    const mark = screen.getByRole("img", { name: "Waiting" });
    expect(mark.textContent).toBe("");
    expect(mark.className).toContain("h-6");
    expect(mark.querySelector('[aria-hidden="true"]')?.className).toContain("bg-warning");
  });
});
