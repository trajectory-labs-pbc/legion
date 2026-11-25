import { expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";

import { MemoryNavigationProvider } from "../../../tests/navigation";
import { MachineLoginRoute } from "./machine-login-route";
import { api } from "./upstream";

function renderRoute(): HTMLElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryNavigationProvider path="/credentials/machine">
      <QueryClientProvider client={queryClient}>
        <MachineLoginRoute />
      </QueryClientProvider>
    </MemoryNavigationProvider>
  ).container;
}

test("MLR-01 a Dispatch without the device grant shows the fork's not-found page", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockResolvedValue({
    machine_code_page: false,
  });
  try {
    renderRoute();
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to inbox" }).getAttribute("href")).toBe("/");
  } finally {
    cleanup();
    capabilities.mockRestore();
  }
});

test("MLR-02 a Dispatch with the device grant shows the machine login page", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockResolvedValue({
    machine_code_page: true,
  });
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    renderRoute();
    expect(await screen.findByRole("heading", { name: "Enter machine login code" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-03 the route is blank while the capabilities answer is out", async () => {
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  try {
    const container = renderRoute();
    expect(capabilities).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();

    answer.resolve({ machine_code_page: false });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
  } finally {
    cleanup();
    capabilities.mockRestore();
  }
});
