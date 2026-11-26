import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { AttentionMark } from "#registry/legion/ui/attention-mark";

describe("AttentionMark", () => {
  it("is a warning chip with the Badge's corner and no edge, holding the count, named by the label", () => {
    render(<AttentionMark count={7} label="Waiting: 7" />);
    const mark = screen.getByRole("img", { name: "Waiting: 7" });
    expect(mark.textContent).toBe("7");
    for (const token of [
      "bg-warning-tint",
      "border-transparent",
      "rounded-badge",
      "text-warning",
      "h-5",
      "min-w-5",
    ]) {
      expect(mark.className).toContain(token);
    }
    expect(mark.className).not.toContain("border-warning-border");
  });

  it("draws no native title unless its caller gives one", () => {
    render(<AttentionMark count={7} label="Waiting: 7" />);
    expect(screen.getByRole("img").hasAttribute("title")).toBe(false);
  });
});
