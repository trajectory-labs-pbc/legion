import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Kbd, KbdSequence } from "#registry/legion/ui/kbd";

describe("Kbd", () => {
  it("renders one chip per step and takes no focus", async () => {
    const { container } = render(
      <>
        <Kbd>Esc</Kbd>
        <KbdSequence chips={["G", "I"]} />
        <KbdSequence chips={[]} />
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
});
