import { expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";

import { MemoryNavigationProvider } from "../../../tests/navigation";
import { MachineLoginRoute } from "./machine-login-route";
import { api } from "./upstream";

test("MLR-01 a Dispatch without the device grant shows the fork's not-found page", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockResolvedValue({
    machine_code_page: false,
  });
  try {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryNavigationProvider path="/credentials/machine">
        <QueryClientProvider client={queryClient}>
          <MachineLoginRoute />
        </QueryClientProvider>
      </MemoryNavigationProvider>
    );
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to inbox" }).getAttribute("href")).toBe("/");
  } finally {
    cleanup();
    capabilities.mockRestore();
  }
});
