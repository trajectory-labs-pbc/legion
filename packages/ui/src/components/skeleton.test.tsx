import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Skeleton } from "#registry/legion/ui/skeleton";

describe("Skeleton", () => {
  it("is a placeholder that takes no focus", async () => {
    const { container } = render(
      <>
        <Skeleton className="h-4 w-24" />
        <button type="button">After</button>
      </>
    );
    expect(container.querySelector("[data-slot=skeleton]")).not.toBeNull();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });
});
