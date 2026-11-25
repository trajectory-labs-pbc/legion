import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { render } from "../../tests/react";
import { StatusCorner } from "./status-corner";

describe("StatusCorner", () => {
  test("says nothing while no write is out and the live feed has not stopped", () => {
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <StatusCorner />
      </QueryClientProvider>
    );
    expect(view.container.querySelector('[data-testid="connection-pill"]')).toBeNull();
    expect(view.container.textContent).toBe("");
    view.unmount();
  });
});
