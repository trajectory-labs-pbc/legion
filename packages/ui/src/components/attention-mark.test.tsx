import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { AttentionMark } from "#registry/legion/ui/attention-mark";

describe("AttentionMark", () => {
  it("is a square warning chip holding the count, with the label as its name", () => {
    render(<AttentionMark count={7} label="Waiting: 7" />);
    const mark = screen.getByRole("img", { name: "Waiting: 7" });
    expect(mark.textContent).toBe("7");
    for (const token of [
      "bg-warning-tint",
      "border-warning-border",
      "text-warning",
      "h-5",
      "rounded-none",
    ]) {
      expect(mark.className).toContain(token);
    }
  });

  it("draws no native title unless its caller gives one", () => {
    render(<AttentionMark count={7} label="Waiting: 7" />);
    expect(screen.getByRole("img").hasAttribute("title")).toBe(false);
  });
});
