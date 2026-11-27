import { afterEach, describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TruncatedText } from "#registry/legion/ui/truncated-text";

// happy-dom lays nothing out; text reads as cut while these stand.
const prototypes = [HTMLSpanElement.prototype, HTMLButtonElement.prototype];
function cutText(): void {
  for (const proto of prototypes) {
    Object.defineProperty(proto, "scrollWidth", { configurable: true, get: () => 200 });
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => 100 });
  }
}

describe("TruncatedText", () => {
  afterEach(() => {
    for (const proto of prototypes) {
      Reflect.deleteProperty(proto, "scrollWidth");
      Reflect.deleteProperty(proto, "clientWidth");
    }
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
});
