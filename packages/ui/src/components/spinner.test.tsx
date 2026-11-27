import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Spinner } from "#registry/legion/ui/spinner";

describe("Spinner", () => {
  it("is a named status that takes no focus", async () => {
    render(
      <>
        <Spinner />
        <Spinner aria-label="Saving" />
        <button type="button">After</button>
      </>
    );
    expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
    expect(screen.getByRole("status", { name: "Saving" })).toBeDefined();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });
});
