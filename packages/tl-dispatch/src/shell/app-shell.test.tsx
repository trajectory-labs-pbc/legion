import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeymapProvider } from "@upstream-dispatch/features/shell/KeymapProvider";
import { act } from "react";

import { MemoryNavigationProvider } from "../../tests/navigation";
import { render, settle } from "../../tests/react";
import { AppShell } from "./app-shell";

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

  test("? anywhere on the shell opens the shortcuts sheet, whose code loads then", async () => {
    mount();
    settle(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true, cancelable: true })
      );
    });
    const sheet = () => document.body.querySelector('[data-slot="sheet-content"]');
    for (let tries = 0; tries < 20 && sheet() === null; tries += 1) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    expect(sheet()?.querySelector("h2")?.textContent).toBe("Keyboard shortcuts");
  });

  test("Shift+S folds the sidebar to its rail and gives main the full width, and again unfolds it", () => {
    // A wide viewport, where the sidebar is a column and can fold.
    const browser = (
      window as unknown as { happyDOM: { setViewport(size: { width: number }): void } }
    ).happyDOM;
    const narrow = window.innerWidth;
    browser.setViewport({ width: 1440 });
    const view = mount();
    // After the shell is gone, so no media query redraws it.
    mounted.push({ unmount: () => browser.setViewport({ width: narrow }) });
    const main = () => view.container.querySelector('[data-testid="main-content"]');
    const rail = () => view.container.querySelector('[data-testid="sidebar-rail"]');
    const fold = () =>
      settle(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "S",
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          })
        );
      });
    expect(main()?.getAttribute("data-shell-layout")).toBe("standard");
    expect(rail()).toBeNull();
    fold();
    expect(main()?.getAttribute("data-shell-layout")).toBe("full-width");
    expect(rail()).not.toBeNull();
    fold();
    expect(main()?.getAttribute("data-shell-layout")).toBe("standard");
    expect(rail()).toBeNull();
  });

  test("$mod+k opens the search palette at once: a key typed next is the palette's", () => {
    mount();
    const press = (init: KeyboardEventInit) =>
      settle(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
        );
      });
    press({ key: "k", code: "KeyK", ctrlKey: true });
    press({ key: "i", code: "KeyI" });
    expect(document.body.querySelector('input[placeholder="Search Dispatch"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="inbox-drawer"]')).toBeNull();
  });
});
