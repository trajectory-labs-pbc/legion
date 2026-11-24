import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeymapProvider } from "@upstream-dispatch/features/shell/KeymapProvider";
import { act } from "react";

import { MemoryNavigationProvider } from "@/navigation/provider";
import { render, settle } from "../../tests/react";
import { AppShell } from "./AppShell";

const realFetch = globalThis.fetch;
const realConfirm = window.confirm;
beforeAll(() => {
  // Reads never answer; a sign-out is refused.
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL) =>
      String(input).includes("/auth/logout")
        ? Promise.resolve(new Response("{}", { status: 403 }))
        : new Promise<Response>(() => {}),
    { preconnect: realFetch.preconnect }
  );
  window.confirm = () => true;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  window.confirm = realConfirm;
});

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

function mount(path = "/agents") {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path={path}>
        <KeymapProvider>
          <AppShell user={{ kind: "user", login: "reader", event_head: "0" }} />
        </KeymapProvider>
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  return view;
}

describe("AppShell", () => {
  test("a refused sign-out still says so after the narrow screen's menu closes and opens", async () => {
    const view = mount();
    const click = (label: string) =>
      settle(() => {
        view.container.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.click();
      });
    const button = (text: string) =>
      [...view.container.querySelectorAll("button")].find((b) => b.textContent === text);
    click("Open navigation");
    settle(() => button("Sign out")?.click());
    const alert = () => view.container.querySelector('[role="alert"]')?.textContent ?? "";
    // The sign-out first waits for the other tabs' answers.
    for (let tries = 0; tries < 40 && alert() === ""; tries += 1) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    }
    expect(alert()).toContain("did not go through");
    click("Close navigation");
    click("Open navigation");
    expect(alert()).toContain("did not go through");
  });
});
