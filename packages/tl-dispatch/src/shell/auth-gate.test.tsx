import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { json, stubFetch, waitFor } from "../../tests/fetch";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { render } from "../../tests/react";
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
      <MemoryNavigationProvider path="/agents">
        <AuthGate />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  cleanups.push(fetch.restore, () => view.unmount());
  return view.container;
}

const sleep = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

describe("AuthGate", () => {
  test("draws the skeleton while Dispatch has not said who is here", () => {
    const container = mount(undefined);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
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
    expect(shell()).not.toBeNull();
    // A narrow screen: the account is behind the menu.
    expect(container.querySelector('[aria-label="Open navigation"]')).not.toBeNull();
  });
});
