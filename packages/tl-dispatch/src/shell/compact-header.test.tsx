import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { stubFetch } from "../../tests/fetch";
import { GlobalCommands } from "../../tests/global-shell";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { render, settle } from "../../tests/react";
import { CompactHeader } from "./compact-header";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function mount(children: ReactNode) {
  const fetch = stubFetch(() => undefined);
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path="/agents">
        <GlobalCommands />
        {children}
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  cleanups.push(fetch.restore, () => view.unmount());
  return view.container;
}

describe("CompactHeader", () => {
  test("is one 44 px row", () => {
    const header = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />
    ).querySelector("header");
    expect(header?.className).toContain("h-11");
    expect(header?.className).not.toContain("wrap");
  });

  test("on the Inbox its link is the open page, with no Peek", () => {
    const home = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />
    );
    const current = home.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe("Inbox");
    expect(home.querySelector('[aria-label="Peek at the inbox"]')).toBeNull();
  });

  test("elsewhere the Inbox links home, beside a Peek at the inbox", () => {
    const away = mount(
      <CompactHeader navigationOpen={false} onInbox={false} onOpenNavigation={() => {}} />
    );
    const links = [...away.querySelectorAll("a")].map(
      (a) => `${a.textContent} ${a.getAttribute("href")}`
    );
    expect(links).toEqual(["Dispatch /", "Inbox /"]);
    expect(away.querySelector('[aria-current="page"]')).toBeNull();
    expect(away.querySelector('[aria-label="Peek at the inbox"]')).not.toBeNull();
  });

  test("Menu says whether the navigation is open and opens it", () => {
    let opened = 0;
    const container = mount(
      <CompactHeader navigationOpen onInbox onOpenNavigation={() => (opened += 1)} />
    );
    const menu = container.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]');
    expect(menu?.getAttribute("aria-expanded")).toBe("true");
    settle(() => menu?.click());
    expect(opened).toBe(1);
  });
});
