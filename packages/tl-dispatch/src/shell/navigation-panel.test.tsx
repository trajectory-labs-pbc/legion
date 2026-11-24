import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { MemoryNavigationProvider } from "@/navigation/provider";
import { stubFetch } from "../../tests/fetch";
import { GlobalCommands } from "../../tests/global-shell";
import { render, settle } from "../../tests/react";
import { NavigationPanel } from "./navigation-panel";
import type { SignOut } from "./use-sign-out";

const user = { kind: "user", login: "reader", event_head: "0" } as const;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function mount(children: ReactNode) {
  const fetch = stubFetch(() => undefined);
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path="/agents">{children}</MemoryNavigationProvider>
    </QueryClientProvider>
  );
  cleanups.push(fetch.restore, () => view.unmount());
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

  test("shows the shell's refusal with a Retry, and holds Sign out while one is out", () => {
    let started = 0;
    const container = mount(
      panel({
        error: "The sign-out did not go through.",
        pending: true,
        start: () => (started += 1),
      })
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("did not go through");
    expect(buttonNamed(container, "Sign out")?.disabled).toBe(true);
    settle(() => buttonNamed(container, "Retry")?.click());
    expect(started).toBe(1);
  });

  test("wide, it offers search, new issue and hiding the sidebar", () => {
    const wide = mount(panel({}));
    expect(buttonNamed(wide, "Search")).toBeDefined();
    expect(buttonNamed(wide, "New issue")).toBeDefined();
    expect(buttonNamed(wide, "Hide sidebar")).toBeDefined();
  });

  test("in a drawer, Close ends it, and there is no sidebar to hide", () => {
    let closed = 0;
    const narrow = mount(panel({}, true, () => (closed += 1)));
    expect(buttonNamed(narrow, "Hide sidebar")).toBeUndefined();
    settle(() => buttonNamed(narrow, "Close navigation")?.click());
    expect(closed).toBe(1);
  });
});
