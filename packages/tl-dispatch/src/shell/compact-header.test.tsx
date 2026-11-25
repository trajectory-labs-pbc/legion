import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { MemoryNavigationProvider } from "@/navigation/provider";
import { stubFetch } from "../../tests/fetch";
import { GlobalCommands } from "../../tests/global-shell";
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
  test("on the Inbox the count is text, with no Peek", () => {
    const home = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />
    );
    expect(home.querySelector("span")?.textContent).toBe("Inbox");
    expect(home.textContent).not.toContain("Peek");
  });

  test("elsewhere the count links home, beside a Peek at the inbox", () => {
    const away = mount(
      <CompactHeader navigationOpen={false} onInbox={false} onOpenNavigation={() => {}} />
    );
    const links = [...away.querySelectorAll("a")].map(
      (a) => `${a.textContent} ${a.getAttribute("href")}`
    );
    expect(links).toEqual(["Dispatch /", "Inbox /"]);
    expect(away.textContent).toContain("Peek");
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
