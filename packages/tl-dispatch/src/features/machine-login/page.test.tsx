import { afterEach, expect, mock, spyOn, test } from "bun:test";
import {
  defaultScheduler,
  focusManager,
  notifyManager,
  onlineManager,
  QueryClient,
} from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, Suspense } from "react";
import { PageFallback } from "@/loading/page-skeleton";
import { api } from "@/upstream/api";
import { credentialCapabilitiesQuery, machineLoginsQuery } from "@/upstream/queries";
import * as resilience from "@/upstream/shell";
import { ErrorBoundary } from "@/upstream/shell";
import { appTree } from "../../../tests/app";
import { changesOutsideAct, shows } from "../../../tests/outside-act";
import { onFakeClock, tick } from "../../../tests/upstream";
import { MachineLoginRoute } from "./page";

afterEach(() => {
  // Back to the synchronous scheduler the shared test setup sets.
  notifyManager.setScheduler((callback) => callback());
  try {
    cleanup();
  } finally {
    mock.restore();
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  }
});

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function routeTree(queryClient = newClient()): ReactNode {
  return appTree(<MachineLoginRoute />, { path: "/credentials/machine", client: queryClient });
}

function renderRoute(): HTMLElement {
  return render(routeTree()).container;
}

const loading = { name: "Loading the page" };

/** What the page outlet shows: the page's error, the page, its skeleton, or nothing. */
const outletState = (host: HTMLElement) =>
  shows(host, '[role="alert"]')
    ? "error"
    : shows(host, "h1")
      ? "page"
      : shows(host, '[role="status"][aria-label="Loading the page"]')
        ? "skeleton"
        : "blank";

/** The route inside the page outlet's boundary, where a page that suspends draws its fallback. */
const inOutlet = (queryClient?: QueryClient) => (
  <Suspense fallback={<PageFallback />}>{routeTree(queryClient)}</Suspense>
);

const inBoundary = (node: ReactNode) => <ErrorBoundary region="this page">{node}</ErrorBoundary>;

/** Capabilities that answer `served`; the logins list answers empty. */
function answers(served: boolean) {
  spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  return spyOn(api, "getCredentialCapabilities").mockResolvedValue({ machine_code_page: served });
}

/** The page's code fails to load until `loads` is set, then loads once `gate` settles; `failed`
 *  settles once the code's query holds a failure. */
function failingCode() {
  const state: { loads: boolean; gate?: Promise<void> } = { loads: false };
  const failed = Promise.withResolvers<void>();
  const loads = spyOn(resilience, "importWhenOnline").mockImplementation((load) => {
    if (state.loads) return (state.gate ?? Promise.resolve()).then(load);
    // A task later, every microtask that carries the rejection into the query has run.
    setTimeout(failed.resolve, 0);
    return Promise.reject(new Error("the chunk is gone"));
  });
  return { state, failed: failed.promise, loads };
}

/** The page's code fails to load, then the capabilities read fails; later reads answer served. */
async function bothFail() {
  answers(true);
  const code = failingCode();
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities")
    .mockReturnValueOnce(answer.promise)
    .mockResolvedValue({ machine_code_page: true });
  render(inBoundary(routeTree()));
  // The code's failure is in before the read fails.
  await act(() => code.failed);
  answer.reject(new Error("broker down"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Could not load the machine login page.");
  return { code, alert, capabilities };
}

test("MLR-01 a Dispatch without the device grant shows the fork's not-found page", async () => {
  answers(false);
  renderRoute();
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
  expect(screen.getByRole("link", { name: "Back to inbox" }).getAttribute("href")).toBe("/");
});

test("MLR-02 a Dispatch with the device grant shows the machine login page", async () => {
  answers(true);
  renderRoute();
  expect(await screen.findByRole("heading", { name: "Enter machine login code" })).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
});

test("MLR-03 a page skeleton shows while the capabilities answer is out, and goes when the answer comes", async () => {
  answers(false);
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const container = renderRoute();
  expect(capabilities).toHaveBeenCalledTimes(1);
  expect(container).toBeEmptyDOMElement();
  expect(await screen.findByRole("status", loading)).toBeDefined();

  answer.resolve({ machine_code_page: false });
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
  expect(screen.queryByRole("status", loading)).toBeNull();
});

test("MLR-05 the logins list is read beside the capabilities read, not after the page mounts", async () => {
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  renderRoute();
  await waitFor(() => expect(logins).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("heading", { name: "Enter machine login code" })).toBeNull();

  answer.resolve({ machine_code_page: true });
  expect(await screen.findByText("No live machine logins.")).toBeDefined();
});

test("MLR-04 a failed capabilities read says so; Retry asks again and keeps the focus", async () => {
  answers(true);
  const again = Promise.withResolvers<{ machine_code_page: boolean }>();
  const capabilities = spyOn(api, "getCredentialCapabilities")
    .mockRejectedValueOnce(new Error("broker down"))
    .mockReturnValueOnce(again.promise);
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
});

test("MLR-03 on a fake clock, a skeleton shown at 200 ms whose answer comes at 253 ms stays until 500 ms, then the page", async () => {
  // The page's code is loaded, so only the answer is waited for.
  await import("./machine-login-page");
  answers(true);
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  await onFakeClock(async () => {
    const start = Date.now();
    renderRoute();
    await tick(150);
    expect(screen.queryByRole("status", loading)).toBeNull();
    await tick(100);
    expect(screen.getByRole("status", loading)).toBeDefined();
    answer.resolve({ machine_code_page: true });
    // The route sees the answer at 253 ms; shown at 200 ms, the skeleton is held until 500 ms.
    await tick(0);
    await tick(245);
    expect(Date.now() - start).toBe(499);
    expect(screen.getByRole("status", loading)).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Enter machine login code" })).toBeNull();
    await tick(0);
    expect(Date.now() - start).toBe(500);
    expect(screen.queryByRole("status", loading)).toBeNull();
    expect(screen.getByRole("heading", { name: "Enter machine login code" })).toBeDefined();
  });
});

test("MLR-03 outside act, a skeleton whose answer comes 50 ms after it showed stands about 300 ms before the page", async () => {
  // The page's code is loaded, so only the answer is waited for.
  await import("./machine-login-page");
  answers(true);
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
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
  // The hold counts whole Date.now() ms from the 200 ms timer, which fires before the skeleton commits.
  expect((page?.at ?? 0) - (skeleton?.at ?? 0)).toBeGreaterThanOrEqual(290);
});

test("MLR-03 outside act, one skeleton covers the answer and the page's code after it: no blank between, and the page no sooner than the code", async () => {
  answers(true);
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  // The page's code comes 400 ms after the skeleton showed, well after the answer.
  const code = Promise.withResolvers<void>();
  spyOn(resilience, "importWhenOnline").mockImplementation((load) => code.promise.then(load));
  let codeAt = Number.POSITIVE_INFINITY;
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
});

test("MLR-06 a revisit, with the answer cached and the page's code loaded, draws the page in its first commit", async () => {
  answers(true);
  const queryClient = newClient();
  const page = { done: (state: string) => state === "page" };
  expect((await changesOutsideAct(inOutlet(queryClient), outletState, page)).at(-1)?.state).toBe(
    "page"
  );
  const revisit = await changesOutsideAct(inOutlet(queryClient), outletState, {
    ...page,
    sync: true,
  });
  expect(revisit.map((change) => change.state)).toEqual(["page"]);
});

test("MLR-07 a page's code that fails to load shows the page's error, with no skeleton before it", async () => {
  answers(true);
  failingCode();
  const changes = await changesOutsideAct(inBoundary(inOutlet()), outletState, {
    done: (state) => state === "error",
  });
  expect(changes.map((change) => change.state)).toEqual(["blank", "error"]);
});

test("MLR-07 outside act, a code load that failed shows the page's error as soon as the answer comes, with no hold on the skeleton", async () => {
  answers(true);
  failingCode();
  const answer = Promise.withResolvers<{ machine_code_page: boolean }>();
  spyOn(api, "getCredentialCapabilities").mockReturnValue(answer.promise);
  const changes = await changesOutsideAct(inBoundary(inOutlet()), outletState, {
    done: (state) => state === "error",
    onChange: (change) => {
      if (change.state === "skeleton") {
        setTimeout(() => answer.resolve({ machine_code_page: true }), 50);
      }
    },
  });
  expect(changes.map((change) => change.state)).toEqual(["blank", "skeleton", "error"]);
  const [, skeleton, error] = changes;
  expect((error?.at ?? 0) - (skeleton?.at ?? 0)).toBeLessThan(200);
});

test("MLR-08 a Dispatch without the device grant shows the not-found page, though the page's code failed to load", async () => {
  answers(false);
  const code = failingCode();
  render(inBoundary(routeTree()));
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
  await act(() => code.failed);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("MLR-08 a failed capabilities read shows its failure, though the page's code failed to load", async () => {
  await bothFail();
});

test("MLR-09 a failed capabilities read's Retry also loads the page's code that failed", async () => {
  const { code, alert, capabilities } = await bothFail();
  const again = Promise.withResolvers<{ machine_code_page: boolean }>();
  capabilities.mockReturnValueOnce(again.promise);
  // The code comes only after the served answer, so the old failure must not stand meanwhile.
  const gate = Promise.withResolvers<void>();
  code.state.loads = true;
  code.state.gate = gate.promise;
  await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
  // The code is asked for as the read starts, before its answer.
  expect(code.loads).toHaveBeenCalledTimes(2);
  again.resolve({ machine_code_page: true });
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  gate.resolve();
  expect(await screen.findByRole("heading", { name: "Enter machine login code" })).toBeDefined();
  // One Retry asks for the code once.
  expect(code.loads).toHaveBeenCalledTimes(2);
});

test.each([
  [
    "the tab's return",
    () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    },
  ],
  [
    "a reconnect",
    () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    },
  ],
])("MLR-09 a failed capabilities read asked again on %s also loads the page's code that failed", async (_, askAgain) => {
  const { code } = await bothFail();
  code.state.loads = true;
  // TanStack Query's own default scheduler, so the read's start and its answer can reach React
  // in one batch, as they can in the app.
  notifyManager.setScheduler(defaultScheduler);
  act(askAgain);
  expect(await screen.findByRole("heading", { name: "Enter machine login code" })).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("MLR-09 a refresh that turns the page served loads the page's code that failed, and no other read asks for it", async () => {
  answers(false);
  const code = failingCode();
  const queryClient = newClient();
  render(inBoundary(routeTree(queryClient)));
  expect(await screen.findByRole("heading", { name: "Page not found" })).toBeDefined();
  await act(() => code.failed);
  await act(() => queryClient.refetchQueries({ queryKey: machineLoginsQuery().queryKey }));
  expect(code.loads).toHaveBeenCalledTimes(1);

  code.state.loads = true;
  spyOn(api, "getCredentialCapabilities").mockResolvedValue({ machine_code_page: true });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: credentialCapabilitiesQuery().queryKey });
  await act(refresh);
  expect(await screen.findByRole("heading", { name: "Enter machine login code" })).toBeDefined();
  // A loaded code is not asked for again.
  await act(refresh);
  expect(code.loads).toHaveBeenCalledTimes(2);
});

test("MLR-09 a visit after the page's code failed to load loads the code again", async () => {
  answers(true);
  const code = failingCode();
  const queryClient = newClient();
  render(inBoundary(routeTree(queryClient)));
  expect((await screen.findByRole("alert")).textContent).toContain("the chunk is gone");
  cleanup();

  code.state.loads = true;
  render(inBoundary(routeTree(queryClient)));
  expect(await screen.findByRole("heading", { name: "Enter machine login code" })).toBeDefined();
});
