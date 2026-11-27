import { expect, spyOn, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, Suspense } from "react";
import { PageFallback } from "@/loading/page-skeleton";
import { api } from "@/upstream/api";
import * as resilience from "@/upstream/shell";
import { ErrorBoundary } from "@/upstream/shell";
import { appTree } from "../../../tests/app";
import { changesOutsideAct, shows } from "../../../tests/outside-act";
import { onFakeClock, tick } from "../../../tests/upstream";
import { MachineLoginRoute } from "./page";

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function routeTree(queryClient = newClient()): ReactNode {
  return appTree(<MachineLoginRoute />, { path: "/credentials/machine", client: queryClient });
}

function renderRoute(): HTMLElement {
  return render(routeTree()).container;
}

const loading = { name: "Loading the page" };

/** What the page outlet shows: the page, its skeleton, or nothing. */
const outletState = (host: HTMLElement) =>
  shows(host, "h1")
    ? "page"
    : shows(host, '[role="status"][aria-label="Loading the page"]')
      ? "skeleton"
      : "blank";

/** The route inside the page outlet's boundary, where a page that suspends draws its fallback. */
const inOutlet = (queryClient?: QueryClient) => (
  <Suspense fallback={<PageFallback />}>{routeTree(queryClient)}</Suspense>
);

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

test("MLR-03 a page skeleton shows while the capabilities answer is out, and goes when the answer comes", async () => {
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

test("MLR-03 on a fake clock, the skeleton shows at 200 ms and, its answer 50 ms after, stands 300 ms before the page", async () => {
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

test("MLR-03 outside act, a skeleton whose answer comes 50 ms after it showed stands 300 ms before the page", async () => {
  // The page's code is loaded, so only the answer is waited for.
  await import("./machine-login-page");
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    const changes = await changesOutsideAct(inOutlet(), outletState, {
      done: (state) => state === "page",
      onChange: (change) => {
        if (change.state === "skeleton") {
          setTimeout(() => answer.resolve({ machine_code_page: true }), 50);
        }
      },
    });
    expect(changes.map((change) => change.state)).toEqual(["blank", "skeleton", "page"]);
    const [, skeleton, page] = changes;
    expect((page?.at ?? 0) - (skeleton?.at ?? 0)).toBeGreaterThanOrEqual(300);
  } finally {
    cleanup();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-03 outside act, one skeleton covers the answer and the page's code after it: no blank between, and the page no sooner than the code", async () => {
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  // The page's code comes 400 ms after the skeleton showed, well after the answer.
  const code = Promise.withResolvers<void>();
  const importWhenOnline = resilience.importWhenOnline;
  const held = spyOn(resilience, "importWhenOnline").mockImplementation((load) =>
    code.promise.then(() => importWhenOnline(load))
  );
  let codeAt = Number.POSITIVE_INFINITY;
  try {
    const changes = await changesOutsideAct(inOutlet(), outletState, {
      done: (state) => state === "page",
      onChange: (change) => {
        if (change.state !== "skeleton") return;
        setTimeout(() => answer.resolve({ machine_code_page: true }), 50);
        setTimeout(() => {
          codeAt = change.at + 400;
          code.resolve();
        }, 400);
      },
    });
    expect(changes.map((change) => change.state)).toEqual(["blank", "skeleton", "page"]);
    const [, skeleton, page] = changes;
    expect(skeleton?.at).toBeGreaterThanOrEqual(200);
    expect((page?.at ?? 0) - (skeleton?.at ?? 0)).toBeGreaterThanOrEqual(300);
    expect(page?.at).toBeGreaterThanOrEqual(codeAt);
  } finally {
    cleanup();
    held.mockRestore();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-06 a revisit, with the answer cached and the page's code loaded, draws the page in its first commit", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockResolvedValue({
    machine_code_page: true,
  });
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const queryClient = newClient();
  try {
    const page = { done: (state: string) => state === "page" };
    expect((await changesOutsideAct(inOutlet(queryClient), outletState, page)).at(-1)?.state).toBe(
      "page"
    );
    const revisit = await changesOutsideAct(inOutlet(queryClient), outletState, {
      ...page,
      sync: true,
    });
    expect(revisit.map((change) => change.state)).toEqual(["page"]);
  } finally {
    cleanup();
    queryClient.clear();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

/** The page's code fails to load until `loads` is set. */
function failingCode() {
  const state = { loads: false };
  const importWhenOnline = resilience.importWhenOnline;
  const spy = spyOn(resilience, "importWhenOnline").mockImplementation((load) =>
    state.loads ? importWhenOnline(load) : Promise.reject(new Error("the chunk is gone"))
  );
  return { state, spy };
}

const inBoundary = (queryClient?: QueryClient) => (
  <ErrorBoundary region="this page">{routeTree(queryClient)}</ErrorBoundary>
);

test("MLR-08 a Dispatch without the device grant shows the not-found page, though the page's code failed to load", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockResolvedValue({
    machine_code_page: false,
  });
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const code = failingCode();
  try {
    render(inBoundary());
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
    await waitFor(() => expect(code.spy).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  } finally {
    cleanup();
    code.spy.mockRestore();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-08 a failed capabilities read shows its failure and Retry, though the page's code failed to load", async () => {
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const code = failingCode();
  try {
    render(inBoundary());
    // The code's failure is in before the read fails.
    await waitFor(() => expect(code.spy).toHaveBeenCalled());
    await act(() => new Promise((settled) => setTimeout(settled, 20)));
    await act(async () => answer.reject(new Error("broker down")));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not load the machine login page.");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeDefined();
    expect(code.spy).toHaveBeenCalled();
  } finally {
    cleanup();
    code.spy.mockRestore();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-09 a visit after the page's code failed to load loads the code again", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockResolvedValue({
    machine_code_page: true,
  });
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const code = failingCode();
  const queryClient = newClient();
  try {
    render(inBoundary(queryClient));
    expect((await screen.findByRole("alert")).textContent).toContain("the chunk is gone");
    cleanup();

    code.state.loads = true;
    render(inBoundary(queryClient));
    expect(await screen.findByRole("heading", { name: "Enter machine login code" })).toBeDefined();
  } finally {
    cleanup();
    queryClient.clear();
    code.spy.mockRestore();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});

test("MLR-07 a page's code that fails to load shows the page's error, with no skeleton before it", async () => {
  const capabilities = spyOn(api, "getCredentialCapabilities").mockResolvedValue({
    machine_code_page: true,
  });
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const failed = spyOn(resilience, "importWhenOnline").mockImplementation(() =>
    Promise.reject(new Error("the chunk is gone"))
  );
  try {
    const changes = await changesOutsideAct(
      <ErrorBoundary region="this page">{inOutlet()}</ErrorBoundary>,
      (host) => (shows(host, '[role="alert"]') ? "error" : outletState(host)),
      { done: (state) => state === "error" }
    );
    expect(changes.map((change) => change.state)).toEqual(["blank", "error"]);
  } finally {
    cleanup();
    failed.mockRestore();
    capabilities.mockRestore();
    logins.mockRestore();
  }
});
