import { afterEach, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MemoryNavigationProvider } from "../../tests/navigation";
import { render } from "../../tests/react";
import { PageRoutes } from "./index";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

test("PageRoutes draws the page an address opens", () => {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path="/nowhere">
        <PageRoutes />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  expect(view.container.textContent).toContain("not found");
});
