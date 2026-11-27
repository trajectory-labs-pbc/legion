import { expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@upstream-dispatch/api/client";

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
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    renderRoute();
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to inbox" }).getAttribute("href")).toBe("/");
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
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

test("MLR-03 the route shows a page skeleton after 200 ms while the capabilities answer is out", async () => {
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    const container = renderRoute();
    expect(capabilities).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
    expect(await screen.findByRole("status", { name: "Loading the page" })).toBeDefined();

    answer.resolve({ machine_code_page: false });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
    expect(screen.queryByRole("status", { name: "Loading the page" })).toBeNull();
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-05 the logins list is read beside the capabilities read, not after the page mounts", async () => {
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    renderRoute();
    await waitFor(() => expect(logins).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Enter machine login code" })).toBeNull();

    answer.resolve({ machine_code_page: true });
    expect(await screen.findByText("No live machine logins.")).toBeDefined();
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-04 a capabilities read that fails with a 500 says so; Retry asks again and keeps the focus", async () => {
  const again = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities")
    .mockRejectedValueOnce(new ApiError(500, { code: "INTERNAL", error: "broker down" }))
    .mockReturnValueOnce(again.promise);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    renderRoute();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not load the machine login page.");
    expect(screen.queryByRole("heading", { name: "Page not found" })).toBeNull();
    const retry = within(alert).getByRole("button", { name: "Retry" });
    await userEvent.click(retry);
    expect(retry.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(retry);
    again.resolve({ machine_code_page: true });
    expect(await screen.findByRole("heading", { name: "Enter machine login code" })).toBeDefined();
    expect(capabilities).toHaveBeenCalledTimes(2);
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-06 a capabilities read the server refuses says so with no Retry, as trying again cannot change it", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockRejectedValue(
    new ApiError(403, { code: "FORBIDDEN", error: "no" })
  );
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    renderRoute();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("You cannot see the machine login page.");
    expect(within(alert).queryByRole("button", { name: "Retry" })).toBeNull();
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-07 a capabilities read the server cannot find says the page is not found, with no Retry", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockRejectedValue(
    new ApiError(404, { code: "NOT_FOUND", error: "gone" })
  );
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    renderRoute();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not find the machine login page.");
    expect(within(alert).queryByRole("button", { name: "Retry" })).toBeNull();
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});
