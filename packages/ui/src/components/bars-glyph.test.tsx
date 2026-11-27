import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { BarsGlyph, type BarsLevel } from "#registry/legion/ui/bars-glyph";

const fills = (glyph: Element) =>
  [...glyph.querySelectorAll("rect, path")].map((part) => part.getAttribute("class"));

describe("BarsGlyph", () => {
  it("is an image named by its label, at the row's glyph size", () => {
    render(<BarsGlyph label="Priority: P1" level={3} />);
    const glyph = screen.getByRole("img", { name: "Priority: P1" });
    expect(glyph.getAttribute("class")).toContain("size-3.5");
  });

  it.each([
    [1, ["fill-foreground", "fill-muted-foreground", "fill-muted-foreground"]],
    [2, ["fill-foreground", "fill-foreground", "fill-muted-foreground"]],
    [3, ["fill-foreground", "fill-foreground", "fill-foreground"]],
  ] as const)("fills %p of its three bars, and mutes the rest", (level, expected) => {
    render(<BarsGlyph label="Level" level={level} />);
    expect(fills(screen.getByRole("img"))).toEqual([...expected]);
  });

  it("draws no level as three muted dashes", () => {
    render(<BarsGlyph label="No priority" level={0} />);
    const glyph = screen.getByRole("img");
    expect(fills(glyph)).toEqual(Array(3).fill("fill-muted-foreground"));
    for (const dash of glyph.querySelectorAll("rect"))
      expect(dash.getAttribute("height")).toBe("1.5");
  });

  it("draws the top level as one filled square with a mark cut out", () => {
    render(<BarsGlyph label="Urgent" level={4} />);
    const glyph = screen.getByRole("img");
    expect(glyph.querySelectorAll("rect")).toHaveLength(0);
    const square = glyph.querySelector("path");
    expect(square?.getAttribute("class")).toBe("fill-foreground");
    expect(square?.getAttribute("fill-rule")).toBe("evenodd");
  });

  it("draws each level differently", () => {
    const drawings = ([0, 1, 2, 3, 4] as BarsLevel[]).map((level) => {
      const { container, unmount } = render(<BarsGlyph label="Level" level={level} />);
      const html = container.innerHTML.replace(/data-level="\d"/, "");
      unmount();
      return html;
    });
    expect(new Set(drawings).size).toBe(5);
  });
});
