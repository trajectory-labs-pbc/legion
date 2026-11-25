import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";

import { useKeptFocus } from "#registry/legion/lib/use-kept-focus";

function Control({ wrapped, own }: { wrapped: boolean; own?: React.Ref<HTMLButtonElement> }) {
  const ref = useKeptFocus(own);
  const button = (
    <button ref={ref} type="button">
      Search
    </button>
  );
  // Another element type, so React draws a new button in place of the old one.
  return wrapped ? <span>{button}</span> : button;
}

describe("useKeptFocus", () => {
  it("gives the focus to the control drawn in place of the one that held it", () => {
    const view = render(<Control wrapped={false} />);
    const before = screen.getByRole("button", { name: "Search" });
    before.focus();
    view.rerender(<Control wrapped />);
    const after = screen.getByRole("button", { name: "Search" });
    expect(after).not.toBe(before);
    expect(document.activeElement).toBe(after);
  });

  it("takes no focus when the control did not hold it", () => {
    const view = render(
      <>
        <input aria-label="Elsewhere" />
        <Control wrapped={false} />
      </>
    );
    screen.getByLabelText("Elsewhere").focus();
    view.rerender(
      <>
        <input aria-label="Elsewhere" />
        <Control wrapped />
      </>
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Elsewhere"));
  });

  it("keeps the control's own ref on the control that is drawn", () => {
    const own = createRef<HTMLButtonElement>();
    const view = render(<Control own={own} wrapped={false} />);
    const drawn = (): HTMLElement | null => own.current;
    expect(drawn()).toBe(screen.getByRole("button", { name: "Search" }));
    view.rerender(<Control own={own} wrapped />);
    expect(drawn()).toBe(screen.getByRole("button", { name: "Search" }));
  });
});
