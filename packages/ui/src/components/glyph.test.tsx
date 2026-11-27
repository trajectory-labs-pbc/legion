import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Glyph } from "#registry/legion/ui/glyph";

describe("Glyph", () => {
  it("is an image named by its label, 16 units at the row's glyph size", () => {
    render(
      <Glyph className="text-foreground" label="Mark">
        <circle cx={8} cy={8} r={4} />
      </Glyph>
    );
    const glyph = screen.getByRole("img", { name: "Mark" });
    expect(glyph.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(glyph.getAttribute("class")).toBe("size-3.5 shrink-0 text-foreground");
    expect(glyph.querySelector("circle")).not.toBeNull();
  });

  it("takes the slot of the glyph that draws in it", () => {
    render(<Glyph data-slot="bars-glyph" label="Mark" />);
    expect(screen.getByRole("img").getAttribute("data-slot")).toBe("bars-glyph");
  });
});
