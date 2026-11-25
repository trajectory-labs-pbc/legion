import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Kbd, KbdSequence } from "#registry/legion/ui/kbd";

describe("Kbd", () => {
  it("renders one chip per step and takes no focus", async () => {
    const { container } = render(
      <>
        <Kbd>Esc</Kbd>
        <KbdSequence steps={[["G"], ["I"]]} />
        <KbdSequence steps={[]} />
        <button type="button">After</button>
      </>
    );
    expect([...container.querySelectorAll("kbd")].map((kbd) => kbd.textContent)).toEqual([
      "Esc",
      "G",
      "I",
    ]);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it("joins a combination's caps, and puts a muted then between a sequence's steps", () => {
    const { container } = render(
      <>
        <KbdSequence steps={[["Shift", "S"]]} />
        <KbdSequence steps={[["G"], ["S"]]} />
      </>
    );
    const [combination, sequence] = container.querySelectorAll('[data-slot="kbd-sequence"]');
    expect(combination?.textContent).toBe("ShiftS");
    expect(sequence?.textContent).toBe("GthenS");
    const then = [...(sequence?.children ?? [])].find((part) => part.textContent === "then");
    expect(then?.tagName).toBe("SPAN");
    expect(then?.className).toContain("text-muted-foreground");
  });
});
