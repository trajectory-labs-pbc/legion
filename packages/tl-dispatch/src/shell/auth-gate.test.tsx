import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { json, stubFetch, waitFor } from "../../tests/fetch";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { render, sleep } from "../../tests/react";
import { shellChunksArrive } from "../../tests/shell-chunks";
import { AuthGate } from "./auth-gate";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function mount(whoami: Response | undefined) {
  const fetch = stubFetch((url) => (url.endsWith("/auth/whoami") ? whoami?.clone() : undefined));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      {/* An address whose page has no chunk, so none arrives while a test waits or after it. */}
      <MemoryNavigationProvider path="/no-such-page">
        <AuthGate />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  cleanups.push(fetch.restore, () => view.unmount());
  return view.container;
}

describe("AuthGate", () => {
  test("draws the skeleton while Dispatch has not said who is here, in the shell's own panel", () => {
    const container = mount(undefined);
    const skeleton = container.querySelector('[aria-busy="true"]');
    expect(skeleton?.querySelector('[data-testid="content-panel"] main')).not.toBeNull();
  });

  test("a 401 draws the sign-in page", async () => {
    const container = mount(json({ error: { code: "UNAUTHORIZED" } }, 401));
    await waitFor(() => container.textContent?.includes("Sign in") === true, sleep);
    expect(container.textContent).toContain("Sign in");
  });

  test("a person draws the shell for them", async () => {
    const container = mount(json({ kind: "user", login: "reader", event_head: "0" }));
    const shell = () => container.querySelector('[data-testid="app-shell"]');
    await waitFor(() => shell() !== null, sleep);
    await shellChunksArrive();
    expect(shell()).not.toBeNull();
    // From 768 px the sidebar names the account.
    expect(container.textContent).toContain("Signed in as reader");
  });
});
