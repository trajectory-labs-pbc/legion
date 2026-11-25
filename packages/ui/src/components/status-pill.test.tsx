import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { Button } from "#registry/legion/ui/button";
import { StatusPill } from "#registry/legion/ui/status-pill";

describe("StatusPill", () => {
  it("announces its line politely, in its tone, and holds a control", () => {
    render(
      <StatusPill tone="danger">
        Live updates are not reaching this page
        <Button size="xs" variant="link">
          Reload
        </Button>
      </StatusPill>
    );
    const pill = screen.getByText(/Live updates/);
    expect(pill.getAttribute("aria-live")).toBe("polite");
    expect(pill.getAttribute("data-tone")).toBe("danger");
    expect(pill.contains(screen.getByRole("button", { name: "Reload" }))).toBe(true);
  });
});
