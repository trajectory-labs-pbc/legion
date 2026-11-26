import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { act, type ReactNode } from "react";

import { loadHotkeyTooltip } from "@/commands/hotkey-tooltip";
import { GlobalCommands } from "../../tests/global-shell";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { holdShellReads } from "../../tests/network";
import { render, settle } from "../../tests/react";
import { shellChunksArrive } from "../../tests/shell-chunks";
import { NavigationPanel } from "./navigation-panel";
import type { SignOut } from "./use-sign-out";

const user = { kind: "user", login: "reader", event_head: "0" } as const;
const cleanups: (() => void)[] = [];
beforeAll(async () => {
  await loadHotkeyTooltip();
  // The account's menu is its own chunk: draw it once, so each test starts with it in place.
  mount(panel({}));
  await shellChunksArrive();
  for (const cleanup of cleanups.splice(0)) cleanup();
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function mount(children: ReactNode) {
  holdShellReads();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path="/agents">{children}</MemoryNavigationProvider>
    </QueryClientProvider>
  );
  cleanups.push(() => view.unmount());
  return view.container;
}

const buttonNamed = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll("button")].find(
    (button) => (button.getAttribute("aria-label") ?? button.textContent) === name
  );

const ACCOUNT = "Signed in as reader";

/** Opens the account's menu, drawn in a portal on the body, and gives its Sign out. */
async function openAccount(container: HTMLElement) {
  const account = buttonNamed(container, ACCOUNT);
  if (account === undefined) throw new Error("no account button");
  await userEvent.setup().click(account);
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent === "Sign out"
  );
}

function panel(signOut: Partial<SignOut>, compact = false, onClose = () => {}) {
  return (
    <>
      <GlobalCommands />
      <NavigationPanel
        closeButtonRef={{ current: null }}
        compact={compact}
        onClose={onClose}
        signOut={{ start: () => {}, pending: false, error: undefined, ...signOut }}
        user={user}
      />
    </>
  );
}

describe("NavigationPanel", () => {
  test("names the account, and its menu's Sign out runs the shell's sign-out", async () => {
    let started = 0;
    const container = mount(panel({ start: () => (started += 1) }));
    // Two steps: no Sign out on the panel itself, and opening the menu signs nobody out.
    expect(buttonNamed(container, "Sign out")).toBeUndefined();
    const signOut = await openAccount(container);
    expect(started).toBe(0);
    settle(() => signOut?.click());
    expect(started).toBe(1);
  });

  test("the account's menu opens the reader's own page", async () => {
    const container = mount(panel({}));
    await openAccount(container);
    const page = [...document.body.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]')].find(
      (item) => item.textContent === "Your page"
    );
    expect(page?.getAttribute("href")).toBe("/people/reader");
  });

  test("shows the shell's refusal with a Retry; both show they are busy while a sign-out is out", () => {
    let started = 0;
    const start = () => (started += 1);
    const error = "The sign-out did not go through.";
    const idle = mount(panel({ error, start }));
    expect(idle.querySelector('[role="alert"]')?.textContent).toContain("did not go through");
    settle(() => buttonNamed(idle, "Retry")?.click());
    expect(started).toBe(1);
    // One panel at a time: each mounts the global commands.
    for (const cleanup of cleanups.splice(0)) cleanup();

    const busy = mount(panel({ error, pending: true, start }));
    for (const name of [ACCOUNT, "Retry"]) {
      expect(buttonNamed(busy, name)?.getAttribute("aria-busy")).toBe("true");
    }
    settle(() => buttonNamed(busy, "Retry")?.click());
    expect(started).toBe(1);
  });

  test("while a sign-out is out, the account's menu does not open", async () => {
    const busy = mount(panel({ pending: true }));
    expect(await openAccount(busy)).toBeUndefined();
  });

  test("wide, its name row offers search, new issue and hiding the sidebar, as icons", () => {
    const wide = mount(panel({}));
    const row = wide.querySelector("a")?.parentElement;
    for (const name of ["Search", "New issue", "Hide sidebar"]) {
      const button = buttonNamed(wide, name);
      expect(button?.parentElement).toBe(row);
      expect(button?.textContent).toBe("");
    }
    expect(row?.className).toContain("h-11");
  });

  test("names the account on one control, which announces its menu", () => {
    const container = mount(panel({}));
    expect(buttonNamed(container, ACCOUNT)?.getAttribute("aria-haspopup")).toBe("menu");
  });

  test("in a drawer, Close ends it, and there is no sidebar to hide", () => {
    let closed = 0;
    const narrow = mount(panel({}, true, () => (closed += 1)));
    expect(buttonNamed(narrow, "Hide sidebar")).toBeUndefined();
    settle(() => buttonNamed(narrow, "Close navigation")?.click());
    expect(closed).toBe(1);
  });

  test("opens the tooltips of its name row's buttons below, clear of the window and each other", async () => {
    const container = mount(panel({}));
    for (const name of ["Hide sidebar", "Search", "New issue"]) {
      const trigger = buttonNamed(container, name);
      if (trigger === undefined) throw new Error(`no ${name} button`);
      settle(() => {
        trigger.dispatchEvent(
          new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" })
        );
        trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        trigger.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 700)));
      settle(() => {});
      const popup = document.querySelector('[data-slot="tooltip-content"]');
      expect(popup?.textContent?.startsWith(name)).toBe(true);
      expect(popup?.getAttribute("data-side")).toBe("bottom");
      settle(() => {
        trigger.dispatchEvent(
          new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" })
        );
        trigger.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });
    }
  });
});
