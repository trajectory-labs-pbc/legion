import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Separator } from "#registry/legion/ui/separator";

describe("Separator", () => {
  it("is a separator in its orientation and takes no focus", async () => {
    render(
      <>
        <Separator orientation="vertical" />
        <button type="button">After</button>
      </>
    );
    expect(screen.getByRole("separator").getAttribute("aria-orientation")).toBe("vertical");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });
});
