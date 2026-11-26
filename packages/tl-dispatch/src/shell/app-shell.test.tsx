import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { answerRequests } from "@upstream-dispatch/__tests__/network";
import { userAgentStateQuery } from "@upstream-dispatch/api/queries";
import { liveViewsOf } from "@upstream-dispatch/features/agent-view/live-views";
import { readRecents } from "@upstream-dispatch/features/search/recents";
import { http } from "msw";
import { act } from "react";

import { commandStore } from "@/commands/command-store";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { holdReads, holdShellReads } from "../../tests/network";
import { render, settle, sleep } from "../../tests/react";
import { shellChunksArrive } from "../../tests/shell-chunks";
import { reader, signedInClient } from "../../tests/writes";
import { AppShell } from "./app-shell";
import { SignedInParts } from "./signed-in-parts";

beforeEach(() => {
  holdShellReads();
  // A sign-out is refused.
  answerRequests(http.post("/auth/logout", () => Response.json({}, { status: 403 })));
});

/** The narrow screen's Menu, named by its text alone. */
const menuButton = (root: HTMLElement) =>
  [...root.querySelectorAll("button")].find((button) => button.textContent === "Menu");

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  // The shell goes first, so no media query redraws it.
  for (const view of mounted.splice(0).reverse()) view.unmount();
  // The signed-in reader's preferences (a folded sidebar) and recents.
  window.localStorage.clear();
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
async function mount(path = "/no-such-page", client = signedInClient()) {
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryNavigationProvider path={path}>
        <SignedInParts>
          <AppShell user={reader} />
        </SignedInParts>
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  await shellChunksArrive();
  return view;
}

/** Waits, a step at a time, for the menu's sheet, whose code loads when it first opens. */
async function until(done: () => boolean) {
  for (let tries = 0; tries < 40 && !done(); tries += 1) {
    await sleep(25);
  }
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
    settle(() => menuButton(document.body)?.click());
    const account = "Signed in as reader";
    await until(() => button(account) !== undefined);
    const accountButton = button(account);
    if (accountButton === undefined) throw new Error("no account button");
    await userEvent.setup().click(accountButton);
    const signOut = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === "Sign out"
    );
    settle(() => signOut?.click());
    // The menu closes; the corner says the sign-out is under way.
    expect(document.body.querySelector('[data-testid="signing-out"]')?.textContent).toBe(
      "Signing out…"
    );
    const alert = () => document.body.querySelector('[role="alert"]')?.textContent ?? "";
    // The sign-out first waits for the other tabs' answers.
    for (let tries = 0; tries < 40 && alert() === ""; tries += 1) {
      await sleep(50);
    }
    expect(alert()).toContain("did not go through");
    click("Close navigation");
    await until(() => button(account) === undefined);
    settle(() => menuButton(document.body)?.click());
    await until(() => button(account) !== undefined);
    expect(alert()).toContain("did not go through");
  });

  test("a refused sign-out from the palette says so, with a Retry, while the sidebar is folded away", async () => {
    viewport(1024);
    const view = await mount();
    settle(() => commandStore.run("global.toggle-sidebar"));
    expect(view.container.querySelector('[data-testid="sidebar"]')).toBeNull();
    settle(() => commandStore.run("global.sign-out"));
    const alert = () => document.body.querySelector('[role="alert"]');
    // The sign-out first waits for the other tabs' answers.
    await until(() => alert() !== null);
    expect(alert()?.textContent).toContain("did not go through");
    expect(alert()?.querySelector("button")?.textContent).toBe("Retry");
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
      await sleep(10);
    }
    expect(sheet()?.querySelector("h2")?.textContent).toBe("Keyboard shortcuts");
    // The sheet takes the focus a moment after it opens.
    await sleep(50);
  });

  const foldKeys = [
    ["Shift+S", { key: "S", shiftKey: true }],
    ["[", { key: "[" }],
  ] as const;

  /** Presses a key where the focus is, as a person does. */
  const pressOnFocus = (init: KeyboardEventInit) =>
    settle(() => {
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true })
      );
    });

  /** The shell's parts that a fold changes, on a viewport where the sidebar is a column. */
  async function foldable() {
    viewport(768);
    const view = await mount();
    const part = (testId: string) =>
      view.container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const button = (name: string) =>
      view.container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
    return { part, button };
  }

  test.each(
    foldKeys
  )("%s folds the sidebar away: the panel fills the window under a row that shows it again", async (_key, init) => {
    const { part, button } = await foldable();
    expect(part("main-content")?.getAttribute("data-shell-layout")).toBe("standard");
    expect(part("panel-header")).toBeNull();
    expect(part("sidebar")?.className).toContain("w-(--sidebar-width)");
    expect(part("content-panel")?.className).not.toContain("md:ml-(--panel-inset)");
    pressOnFocus(init);
    expect(part("main-content")?.getAttribute("data-shell-layout")).toBe("full-width");
    expect(part("sidebar")).toBeNull();
    // Inset 8 px on all four sides, with a 44 px row on top that holds only Show sidebar and
    // stays in view while the page scrolls, over a strip that hides the page in the inset.
    expect(part("content-panel")?.className.split(" ")).toEqual(
      expect.arrayContaining(["md:ml-(--panel-inset)", "[--panel-row:--spacing(11)]"])
    );
    const row = part("panel-header");
    expect(row?.parentElement).toBe(part("content-panel"));
    expect(row?.className.split(" ")).toEqual(
      expect.arrayContaining([
        "h-(--panel-row)",
        "border-b",
        "sticky",
        "top-(--panel-inset)",
        "bg-card",
        "before:h-(--panel-inset)",
        "before:bg-background",
      ])
    );
    expect(
      [...(row?.querySelectorAll("button") ?? [])].map((b) => b.getAttribute("aria-label"))
    ).toEqual(["Show sidebar"]);
    pressOnFocus(init);
    expect(part("main-content")?.getAttribute("data-shell-layout")).toBe("standard");
    expect(part("panel-header")).toBeNull();
    expect(button("Show sidebar")).toBeNull();
  });

  test.each(
    foldKeys
  )("%s from inside the sidebar hands the focus to Show sidebar, and back to Hide sidebar", async (_key, init) => {
    const { part, button } = await foldable();
    settle(() => part("sidebar")?.querySelector<HTMLElement>("a[href]")?.focus());
    expect(part("sidebar")?.contains(document.activeElement)).toBe(true);
    // The focused button shows its tooltip, which places itself a moment later.
    const placed = () => sleep(50);
    pressOnFocus(init);
    expect(document.activeElement).toBe(button("Show sidebar"));
    await placed();
    pressOnFocus(init);
    expect(document.activeElement).toBe(button("Hide sidebar"));
    await placed();
  });

  test.each(foldKeys)("%s from the page leaves the focus where it is", async (_key, init) => {
    const { part } = await foldable();
    const main = part("main-content");
    settle(() => main?.focus());
    pressOnFocus(init);
    expect(part("sidebar")).toBeNull();
    expect(document.activeElement).toBe(main);
    pressOnFocus(init);
    expect(part("sidebar")).not.toBeNull();
    expect(document.activeElement).toBe(main);
  });

  test.each([
    767, 768,
  ])("below 768 px the navigation is a drawer under a top bar, and from 768 px a column: %i px", async (width) => {
    viewport(width);
    const view = await mount();
    const column = view.container.querySelector('[data-testid="sidebar"]');
    const menu = menuButton(view.container);
    expect([column !== null, menu !== undefined]).toEqual(
      width < 768 ? [false, true] : [true, false]
    );
  });

  test("draws the inverted L: the sidebar on the window's ground, main in an inset rounded card", async () => {
    viewport(1440);
    const view = await mount();
    const sidebar = view.container.querySelector('[data-testid="sidebar"]');
    const panel = view.container.querySelector('[data-testid="content-panel"]');
    expect(sidebar?.className).toContain("bg-background");
    expect(sidebar?.className).not.toContain("border-r");
    expect(panel?.contains(view.container.querySelector("main"))).toBe(true);
    for (const name of [
      "bg-card",
      "md:border",
      "md:rounded-lg",
      "md:my-(--panel-inset)",
      "md:mr-(--panel-inset)",
    ]) {
      expect(panel?.className.split(" ")).toContain(name);
    }
    expect(panel?.className).not.toContain("shadow");
    // The content is clipped to the corner, not the panel, whose sticky row reaches past its edges.
    expect(panel?.className).not.toContain("overflow-clip");
    expect(panel?.lastElementChild?.className.split(" ")).toEqual(
      expect.arrayContaining(["md:overflow-clip", "md:rounded-b-lg", "md:rounded-t-lg"])
    );
  });

  test("SHL-12 the issue a person opens joins their recent items", async () => {
    // The issue page's own reads.
    holdReads("/api/v1/issues/AB-1", "/api/v1/issues/AB-1/*", "/api/v1/me/state");
    await mount("/issues/AB-1");
    await act(async () => {
      await import("@upstream-dispatch/features/issue-page/IssuePage");
      await sleep(0);
    });
    expect(readRecents(reader.login)).toEqual([{ label: "AB-1", path: "/issues/AB-1" }]);
  });

  // Each part's duty has its own test; these say only that the shell mounts the part.
  test("SHL-3 the shell gives its pages their contexts: the margin draws in them", async () => {
    const view = await mount();
    expect(view.container.querySelector('[data-testid="margin-sheet"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="error-boundary"]')).toBeNull();
  });

  test("SHL-13 the shell hands the live views the person's pins", async () => {
    const client = signedInClient();
    client.setQueryData(userAgentStateQuery().queryKey, {
      pinned: { pinned_at: "2026-11-01T00:00:00Z", unread_replies: 0 },
    });
    await mount(undefined, client);
    // A draft written and then emptied leaves a view that only a pin keeps.
    settle(() => {
      liveViewsOf(client).setDraft("pinned", "Hi");
      liveViewsOf(client).setDraft("pinned", "");
    });
    expect(Object.keys(window.__dispatchLiveViews?.views ?? {})).toEqual(["pinned"]);
  });

  test("SHL-15 the shell mounts its status corner", async () => {
    const view = await mount();
    expect(view.container.querySelector('[data-testid="connection-status"]')).not.toBeNull();
  });

  test("SHL-31 the skip link leads to main, which takes the focus, and draws the app's focus ring", async () => {
    const view = await mount();
    const skip = view.container.querySelector('a[href="#main-content"]');
    expect(skip?.className).toContain("focus-visible:outline-focus");
    const main = view.container.querySelector<HTMLElement>("#main-content");
    expect(main?.tagName).toBe("MAIN");
    expect(main?.getAttribute("tabindex")).toBe("-1");
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
    const openMenu = async () => {
      viewport(375);
      await mount();
      settle(() => menuButton(document.body)?.click());
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

    test("SHL-11 i closes the menu and opens the inbox drawer", async () => {
      await openMenu();
      press({ key: "i", code: "KeyI" });
      await until(() => menu() === null);
      expect(menu()).toBeNull();
      expect(document.body.querySelector('[data-testid="inbox-drawer"]')).not.toBeNull();
    });
  });
});
