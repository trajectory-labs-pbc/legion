import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { StateGlyph, type StateShape } from "#registry/legion/ui/state-glyph";

const SHAPES: readonly StateShape[] = [
  { kind: "arrows" },
  { kind: "dashed" },
  { kind: "dashed-dot" },
  { kind: "empty" },
  { kind: "pie", level: 1 },
  { kind: "pie", level: 2 },
  { kind: "pie", level: 3 },
  { kind: "pie", level: 4 },
  { kind: "check" },
  { kind: "cross" },
];

/** The glyph's drawing, with the mask's id, which differs on each render, left out. */
const drawing = (glyph: Element) => glyph.innerHTML.replace(/(id="|url\(#)[^")]+/g, "$1");

describe("StateGlyph", () => {
  it("is an image named by its label, at the row's glyph size", () => {
    render(<StateGlyph label="Status: Todo" shape={{ kind: "empty" }} />);
    const glyph = screen.getByRole("img", { name: "Status: Todo" });
    expect(glyph.getAttribute("class")).toContain("size-3.5");
    expect(glyph.getAttribute("data-kind")).toBe("empty");
  });

  it("draws each shape differently", () => {
    const drawings = SHAPES.map((shape) => {
      const { unmount } = render(<StateGlyph label="State" shape={shape} />);
      const html = drawing(screen.getByRole("img"));
      unmount();
      return html;
    });
    expect(new Set(drawings).size).toBe(SHAPES.length);
  });

  it("is monochrome: each part is the foreground or muted", () => {
    for (const shape of SHAPES) {
      const { unmount } = render(<StateGlyph label="State" shape={shape} />);
      const classes = [...screen.getByRole("img").querySelectorAll("[class]")].flatMap((part) =>
        (part.getAttribute("class") ?? "").split(" ")
      );
      const colours = classes.filter(
        (name) => /^(fill|stroke)-/.test(name) && name !== "fill-none"
      );
      expect(colours.length).toBeGreaterThan(0);
      expect(colours.filter((name) => !/^(fill|stroke)-(muted-)?foreground$/.test(name))).toEqual(
        []
      );
      unmount();
    }
  });

  it("cuts a disc's mark out with a mask of its own", () => {
    const { container } = render(
      <>
        <StateGlyph label="Done" shape={{ kind: "check" }} />
        <StateGlyph label="Closed" shape={{ kind: "cross" }} />
      </>
    );
    const ids = [...container.querySelectorAll("mask")].map((mask) => mask.id);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(container.querySelector(`circle[mask="url(#${id})"]`)).not.toBeNull();
    }
  });
});
