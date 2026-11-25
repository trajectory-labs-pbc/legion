import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { render } from "../../tests/react";
import { StatusCorner } from "./status-corner";

describe("StatusCorner", () => {
  test("says nothing while no write is out and the live feed has not stopped, and holds its live region", () => {
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <StatusCorner />
      </QueryClientProvider>
    );
    expect(view.container.querySelector('[data-testid="connection-pill"]')).toBeNull();
    expect(view.container.textContent).toBe("");
    // The live region is there before its line, so the line is announced when it appears.
    const region = view.container.querySelector('[role="status"]');
    expect(region?.childElementCount).toBe(0);
    // A hidden region is out of the accessibility tree, and its first line goes unannounced.
    expect(region?.className).not.toContain("hidden");
    view.unmount();
  });
});
