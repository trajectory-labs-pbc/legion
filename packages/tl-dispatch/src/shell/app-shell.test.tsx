import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeymapProvider } from "@upstream-dispatch/features/shell/KeymapProvider";
import { act } from "react";

import { MemoryNavigationProvider } from "../../tests/navigation";
import { render, settle } from "../../tests/react";
import { shellChunksArrive } from "../../tests/shell-chunks";
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
  // The shell goes first, so no media query redraws it.
  for (const view of mounted.splice(0).reverse()) view.unmount();
});

const browser = (window as unknown as { happyDOM: { setViewport(size: { width: number }): void } })
  .happyDOM;

/** Draws the next mount at `width`, and restores the width after the shell is gone. */
function viewport(width: number) {
  const before = window.innerWidth;
  browser.setViewport({ width });
  mounted.push({ unmount: () => browser.setViewport({ width: before }) });
}

// An address whose page has no chunk, so none arrives while a test waits or after it.
async function mount(path = "/no-such-page") {
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
  await shellChunksArrive();
  return view;
}

describe("AppShell", () => {
  test("a refused sign-out still says so after the narrow screen's menu closes and opens", async () => {
    viewport(375);
    await mount();
    // The menu is a sheet, drawn in a portal on the body.
    const click = (label: string) =>
      settle(() => {
        document.body.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.click();
      });
    const button = (text: string) =>
      [...document.body.querySelectorAll("button")].find((b) => b.textContent === text);
    /** Waits, a step at a time, for the menu's sheet, whose code loads when it first opens. */
    const until = async (done: () => boolean) => {
      for (let tries = 0; tries < 40 && !done(); tries += 1) {
        await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
      }
    };
    click("Open navigation");
    await until(() => button("Sign out") !== undefined);
    settle(() => button("Sign out")?.click());
    const alert = () => document.body.querySelector('[role="alert"]')?.textContent ?? "";
    // The sign-out first waits for the other tabs' answers.
    for (let tries = 0; tries < 40 && alert() === ""; tries += 1) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    }
    expect(alert()).toContain("did not go through");
    click("Close navigation");
    await until(() => button("Sign out") === undefined);
    click("Open navigation");
    await until(() => button("Sign out") !== undefined);
    expect(alert()).toContain("did not go through");
  });

  test("? anywhere on the shell opens the shortcuts sheet, whose code loads then", async () => {
    await mount();
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
    // The sheet takes the focus a moment after it opens.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  });

  test.each([
    ["Shift+S", { key: "S", shiftKey: true }],
    ["[", { key: "[" }],
  ] as const)("%s folds the sidebar to its rail and gives main the full width, and again unfolds it", async (_key, init) => {
    // A viewport where the sidebar is a column and can fold.
    viewport(768);
    const view = await mount();
    const main = () => view.container.querySelector('[data-testid="main-content"]');
    const rail = () => view.container.querySelector('[data-testid="sidebar-rail"]');
    const fold = () =>
      settle(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true })
        );
      });
    const panel = () => view.container.querySelector('[data-testid="content-panel"]');
    const sidebar = () => view.container.querySelector('[data-testid="sidebar"]');
    expect(main()?.getAttribute("data-shell-layout")).toBe("standard");
    expect(rail()).toBeNull();
    expect(sidebar()?.className).toContain("w-60");
    expect(panel()?.className).not.toContain("md:ml-14");
    fold();
    expect(main()?.getAttribute("data-shell-layout")).toBe("full-width");
    expect(rail()).not.toBeNull();
    expect(sidebar()).toBeNull();
    expect(panel()?.className).toContain("md:ml-14");
    fold();
    expect(main()?.getAttribute("data-shell-layout")).toBe("standard");
    expect(rail()).toBeNull();
  });

  test.each([
    767, 768,
  ])("below 768 px the navigation is a drawer under a top bar, and from 768 px a column: %i px", async (width) => {
    viewport(width);
    const view = await mount();
    const column = view.container.querySelector('[data-testid="sidebar"]');
    const menu = view.container.querySelector('[aria-label="Open navigation"]');
    expect([column !== null, menu !== null]).toEqual(width < 768 ? [false, true] : [true, false]);
  });

  test("draws the inverted L: the sidebar on the window's ground, main in an inset card", async () => {
    viewport(1440);
    const view = await mount();
    const sidebar = view.container.querySelector('[data-testid="sidebar"]');
    const panel = view.container.querySelector('[data-testid="content-panel"]');
    expect(sidebar?.className).toContain("bg-background");
    expect(sidebar?.className).not.toContain("border-r");
    expect(panel?.contains(view.container.querySelector("main"))).toBe(true);
    for (const name of ["bg-card", "md:border", "md:my-2", "md:mr-2"]) {
      expect(panel?.className.split(" ")).toContain(name);
    }
    expect(panel?.className).not.toContain("shadow");
  });

  test("$mod+k opens the search palette at once: a key typed next is the palette's", async () => {
    await mount();
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

  describe("in the narrow screen's menu", () => {
    const menu = () => document.body.querySelector('[data-slot="sheet-content"][data-open]');
    const until = async (done: () => boolean) => {
      for (let tries = 0; tries < 40 && !done(); tries += 1) {
        await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
      }
    };
    const openMenu = async () => {
      viewport(375);
      await mount();
      settle(() => {
        document.body.querySelector<HTMLElement>('[aria-label="Open navigation"]')?.click();
      });
      // The menu takes the focus a moment after it opens.
      await until(() => menu()?.contains(document.activeElement) === true);
    };
    const press = (init: KeyboardEventInit) =>
      settle(() => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
        );
      });

    test("$mod+k opens the search palette and closes the menu", async () => {
      await openMenu();
      press({ key: "k", code: "KeyK", ctrlKey: true });
      expect(document.body.querySelector('input[placeholder="Search Dispatch"]')).not.toBeNull();
      await until(() => menu() === null);
      expect(menu()).toBeNull();
    });

    test("a go-to chord closes the menu", async () => {
      await openMenu();
      press({ key: "g", code: "KeyG" });
      press({ key: "i", code: "KeyI" });
      await until(() => menu() === null);
      expect(menu()).toBeNull();
    });
  });
});
