import { describe, expect, it } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { Slider } from "#registry/legion/ui/slider";

describe("Slider", () => {
  // jsdom measures nothing, so Base UI keeps the thumbs hidden: Tab skips them and queries see no
  // name, so the test focuses the thumb and reads its label.
  it("steps with the arrows and jumps with Home and End", async () => {
    render(<Slider defaultValue={50} aria-label="Volume" />);
    const thumb = screen.getByRole("slider", { hidden: true });
    expect(thumb.getAttribute("aria-label")).toBe("Volume");
    act(() => thumb.focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(thumb.getAttribute("aria-valuenow")).toBe("51");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(thumb.getAttribute("aria-valuenow")).toBe("49");
    await userEvent.keyboard("{End}");
    expect(thumb.getAttribute("aria-valuenow")).toBe("100");
    await userEvent.keyboard("{Home}");
    expect(thumb.getAttribute("aria-valuenow")).toBe("0");
  });

  it("renders one thumb per value", () => {
    render(
      <Slider defaultValue={[20, 80]} getAriaLabel={(index) => (index === 0 ? "From" : "To")} />
    );
    const thumbs = screen.getAllByRole("slider", { hidden: true });
    expect(thumbs.map((thumb) => thumb.getAttribute("aria-label"))).toEqual(["From", "To"]);
  });

  it("follows a controlled value", async () => {
    function Zoom() {
      const [zoom, setZoom] = useState(10);
      return (
        <>
          <Slider
            aria-label="Zoom"
            value={zoom}
            onValueChange={(value) => typeof value === "number" && setZoom(value)}
          />
          <output>{zoom}</output>
        </>
      );
    }
    render(<Zoom />);
    const thumb = screen.getByRole("slider", { hidden: true });
    act(() => thumb.focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("status").textContent).toBe("11");
    expect(thumb.getAttribute("aria-valuenow")).toBe("11");
  });

  it("starts at its minimum with no value", () => {
    render(<Slider min={5} aria-label="Speed" />);
    const thumb = screen.getByRole("slider", { hidden: true });
    expect(thumb.getAttribute("aria-valuenow")).toBe("5");
    expect(thumb.getAttribute("aria-label")).toBe("Speed");
  });

  // happy-dom lays nothing out, so the classes stand for the box: 16 px, grown 4 px each way.
  // Base UI places the thumb with `position: absolute`, which the pseudo-element is set against.
  it("takes the pointer across 24 px with a pseudo-element around each 16 px thumb", () => {
    const { container } = render(<Slider defaultValue={[20, 80]} />);
    const thumbs = [...container.querySelectorAll('[data-slot="slider-thumb"]')];
    expect(thumbs).toHaveLength(2);
    for (const { classList } of thumbs) {
      for (const name of ["size-4", "after:absolute", "after:-inset-1"]) {
        expect(classList.contains(name), name).toBe(true);
      }
    }
  });
});
