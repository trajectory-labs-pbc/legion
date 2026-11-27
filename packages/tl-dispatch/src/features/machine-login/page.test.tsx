import { expect, spyOn, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, Suspense } from "react";
import { PageFallback } from "@/loading/page-skeleton";
import { api } from "@/upstream/api";
import { appTree } from "../../../tests/app";
import { changesOutsideAct, shows } from "../../../tests/outside-act";
import { onFakeClock, tick } from "../../../tests/upstream";
import { MachineLoginRoute } from "./page";

function routeTree(): ReactNode {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return appTree(<MachineLoginRoute />, { path: "/credentials/machine", client: queryClient });
}

function renderRoute(): HTMLElement {
  return render(routeTree()).container;
}

const loading = { name: "Loading the page" };

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

test("MLR-04 a failed capabilities read says so; Retry asks again and keeps the focus", async () => {
  const again = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities")
    .mockRejectedValueOnce(new Error("broker down"))
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

test("MLR-03 a page skeleton whose answer comes 50 ms after it showed stays until it has stood 300 ms, then the page", async () => {
  // The page's code is loaded, so only the answer is waited for.
  await import("./machine-login-page");
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    await onFakeClock(async () => {
      renderRoute();
      await tick(150);
      expect(screen.queryByRole("status", loading)).toBeNull();
      await tick(100);
      expect(screen.getByRole("status", loading)).toBeDefined();
      answer.resolve({ machine_code_page: true });
      await tick(200);
      expect(screen.getByRole("status", loading)).toBeDefined();
      expect(screen.queryByRole("heading", { name: "Enter machine login code" })).toBeNull();
      await tick(100);
      expect(screen.queryByRole("status", loading)).toBeNull();
      expect(screen.getByRole("heading", { name: "Enter machine login code" })).toBeDefined();
    });
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-03 outside act, one page skeleton covers the answer and the page's code: no blank between, held 300 ms", async () => {
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    // Inside the page outlet's boundary, where a page that suspends would draw its fallback.
    const changes = await changesOutsideAct(
      <Suspense fallback={<PageFallback />}>{routeTree()}</Suspense>,
      (host) =>
        shows(host, "h1")
          ? "page"
          : shows(host, '[role="status"][aria-label="Loading the page"]')
            ? "skeleton"
            : "blank",
      {
        done: (state) => state === "page",
        onChange: (change) => {
          if (change.state === "skeleton")
            setTimeout(() => answer.resolve({ machine_code_page: true }), 50);
        },
      }
    );
    expect(changes.map((change) => change.state)).toEqual(["blank", "skeleton", "page"]);
    const [, skeleton, page] = changes;
    expect(skeleton?.at).toBeGreaterThanOrEqual(200);
    expect((page?.at ?? 0) - (skeleton?.at ?? 0)).toBeGreaterThanOrEqual(300);
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});
