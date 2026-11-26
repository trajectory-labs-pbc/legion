import { afterEach, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { GlobalCommands } from "../../tests/global-shell";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { holdShellReads } from "../../tests/network";
import { render, settle } from "../../tests/react";
import { ContentPanel } from "./content-panel";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** happy-dom's IntersectionObserver never reports: this one reports what a test tells it. */
class FakeObserver {
  static report: ((entry: Partial<IntersectionObserverEntry>) => void) | undefined;
  constructor(callback: IntersectionObserverCallback) {
    FakeObserver.report = (entry) =>
      callback([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  observe() {}
  disconnect() {
    FakeObserver.report = undefined;
  }
}

test("the folded sidebar's row is stuck only while the page has scrolled under it", () => {
  const real = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
  cleanups.push(() => {
    globalThis.IntersectionObserver = real;
  });
  holdShellReads();
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path="/agents">
        <GlobalCommands />
        <ContentPanel fillsViewport={false} issueFrame={false} marginRail={false} sidebarFolded>
          {null}
        </ContentPanel>
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  cleanups.push(() => view.unmount());
  const row = view.container.querySelector('[data-testid="panel-header"]');
  if (!row) throw new Error("no row");
  const at = (top: number, isIntersecting: boolean) =>
    settle(() =>
      FakeObserver.report?.({ boundingClientRect: new DOMRect(0, top, 0, 0), isIntersecting })
    );

  // At rest the row's place is in view.
  at(9, true);
  expect(row.hasAttribute("data-stuck")).toBe(false);
  // Scrolled, the page takes the row's place up with it, out over the row's line.
  at(-200, false);
  expect(row.getAttribute("data-stuck")).toBe("true");
  // A place below the window is not one the page has scrolled past.
  at(2000, false);
  expect(row.hasAttribute("data-stuck")).toBe(false);
});
