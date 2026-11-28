import { afterEach, describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TruncatedText } from "#registry/legion/ui/truncated-text";

// happy-dom lays nothing out; text reads as cut while these stand. Only a span reads as cut: the
// span inside the button is the element measured.
const span = HTMLSpanElement.prototype;
function cutText(): void {
  Object.defineProperty(span, "scrollWidth", { configurable: true, get: () => 200 });
  Object.defineProperty(span, "clientWidth", { configurable: true, get: () => 100 });
}

describe("TruncatedText", () => {
  afterEach(() => {
    Reflect.deleteProperty(span, "scrollWidth");
    Reflect.deleteProperty(span, "clientWidth");
  });

  it("is plain text while the text fits", () => {
    render(<TruncatedText text="devbox.example.com" />);
    expect(screen.getByText("devbox.example.com").tagName).toBe("SPAN");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens no tooltip on hover while the text fits", async () => {
    render(<TruncatedText text="devbox.example.com" />);
    await userEvent.hover(screen.getByText("devbox.example.com"));
    // Past the trigger's half-second hover delay.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(screen.getAllByText("devbox.example.com")).toHaveLength(1);
  });

  it("is a button Tab reaches while the text is cut, whose tooltip shows it in full", async () => {
    cutText();
    render(<TruncatedText text="devbox.example.com" />);
    const text = await screen.findByRole("button", { name: "devbox.example.com" });
    expect(text.getAttribute("data-slot")).toBe("truncated-text");
    await userEvent.tab();
    expect(document.activeElement).toBe(text);
    await waitFor(() => expect(screen.getAllByText("devbox.example.com")).toHaveLength(2));
  });

  // happy-dom lays nothing out, so the classes stand for the target: a 24 px band across the
  // button's middle. The span inside cuts the text, so the button clips none of the band.
  it("takes the pointer across 24 px of height while the text is cut", async () => {
    cutText();
    render(<TruncatedText text="devbox.example.com" />);
    const button = await screen.findByRole("button", { name: "devbox.example.com" });
    const classes = button.className.split(" ");
    expect(classes).toEqual(
      expect.arrayContaining([
        "relative",
        "min-w-0",
        "after:absolute",
        "after:inset-x-0",
        "after:top-1/2",
        "after:h-6",
        "after:-translate-y-1/2",
      ])
    );
    expect(classes, "a button that clips its band").not.toContain("truncate");
  });
});
