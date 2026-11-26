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

/** Puts `element`'s top edge `top` px below the window's. */
const placeAt = (element: Element, top: number) => {
  element.getBoundingClientRect = () => new DOMRect(0, top, 0, 0);
};

test("the folded sidebar's row is stuck only once the page scrolls under it, and only then draws its strip", () => {
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
  const mark = row?.previousElementSibling;
  if (!row || !mark) throw new Error("no row or no mark before it");
  const scroll = () => settle(() => window.dispatchEvent(new Event("scroll")));

  // At rest the row is where it would be: rounded, with no strip over the panel's top edge.
  placeAt(mark, 8);
  placeAt(row, 8);
  scroll();
  expect(row.hasAttribute("data-stuck")).toBe(false);
  // Scrolled, the page takes the row's place up with it, and the row stays at the inset.
  placeAt(mark, -200);
  scroll();
  expect(row.getAttribute("data-stuck")).toBe("true");
  expect(row.className.split(" ")).toEqual(
    expect.arrayContaining([
      "md:rounded-t-lg",
      "md:data-stuck:rounded-t-none",
      "before:hidden",
      "data-stuck:before:block",
      "before:-inset-x-(--border-width)",
    ])
  );
  placeAt(mark, 8);
  scroll();
  expect(row.hasAttribute("data-stuck")).toBe(false);
});
