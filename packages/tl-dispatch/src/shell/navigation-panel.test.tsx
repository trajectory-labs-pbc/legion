import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";

import { loadHotkeyTooltip } from "@/commands/hotkey-tooltip";
import { GlobalCommands } from "../../tests/global-shell";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { holdShellReads } from "../../tests/network";
import { render, settle } from "../../tests/react";
import { NavigationPanel } from "./navigation-panel";
import type { SignOut } from "./use-sign-out";

const user = { kind: "user", login: "reader", event_head: "0" } as const;
const cleanups: (() => void)[] = [];
beforeAll(() => loadHotkeyTooltip());
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
  test("names the account, and its Sign out runs the shell's sign-out", () => {
    let started = 0;
    const container = mount(panel({ start: () => (started += 1) }));
    expect(container.textContent).toContain("Signed in as reader");
    settle(() => buttonNamed(container, "Sign out")?.click());
    expect(started).toBe(1);
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
    for (const name of ["Sign out", "Retry"]) {
      expect(buttonNamed(busy, name)?.getAttribute("aria-busy")).toBe("true");
    }
    settle(() => buttonNamed(busy, "Retry")?.click());
    expect(started).toBe(1);
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

  test("names the account on one row, beside Sign out", () => {
    const container = mount(panel({}));
    const account = [...container.querySelectorAll("p")].find((p) =>
      p.textContent?.startsWith("Signed in as")
    );
    expect(account?.parentElement).toBe(buttonNamed(container, "Sign out")?.parentElement);
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
