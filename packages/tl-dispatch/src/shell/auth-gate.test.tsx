import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { answerRequests } from "@upstream-dispatch/__tests__/network";
import { http } from "msw";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { holdReads, holdShellReads } from "../../tests/network";
import { render } from "../../tests/react";
import { shellChunksArrive } from "../../tests/shell-chunks";
import { AuthGate } from "./auth-gate";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      {/* An address whose page has no chunk, so none arrives while a test waits or after it. */}
      <MemoryNavigationProvider path="/no-such-page">
        <AuthGate />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  cleanups.push(() => view.unmount());
  return view.container;
}

describe("AuthGate", () => {
  test("draws the skeleton while Dispatch has not said who is here", () => {
    holdReads("/auth/whoami");
    const container = mount();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  test("a 401 draws the sign-in page", async () => {
    answerRequests(
      http.get("/auth/whoami", () =>
        Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
      )
    );
    const container = mount();
    await waitFor(() => expect(container.textContent).toContain("Sign in"));
  });

  test("a person draws the shell for them", async () => {
    // The shell's own reads stay pending; only the sign-in check answers.
    holdShellReads();
    answerRequests(
      http.get("/auth/whoami", () =>
        Response.json({ kind: "user", login: "reader", event_head: "0" })
      )
    );
    const container = mount();
    await waitFor(() =>
      expect(container.querySelector('[data-testid="app-shell"]')).not.toBeNull()
    );
    await shellChunksArrive();
    // A narrow screen: the account is behind the menu.
    expect(container.querySelector('[aria-label="Open navigation"]')).not.toBeNull();
  });
});
