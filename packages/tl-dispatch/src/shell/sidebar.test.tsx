import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";

import { NAV_DESTINATIONS } from "@/commands/catalog";
import { MemoryNavigationProvider } from "@/navigation/provider";
import { render } from "../../tests/react";
import { useGlobalCommands } from "./global-commands";
import { NAV_PAGES } from "./nav-pages";
import { Sidebar } from "./sidebar";

const realFetch = globalThis.fetch;
beforeAll(() => {
  // Reads stay pending: the rows draw from the nav table alone.
  globalThis.fetch = Object.assign(() => new Promise<Response>(() => {}), {
    preconnect: realFetch.preconnect,
  });
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

const user = { kind: "user", login: "reader" } as const satisfies Pick<
  AuthenticatedUser,
  "kind" | "login"
>;

function Commands({ enabled }: { enabled: boolean }) {
  const run = () => {};
  useGlobalCommands({
    openSearch: run,
    toggleShortcuts: run,
    createIssue: run,
    goTo: enabled ? run : () => {},
    openDocuments: undefined,
    toggleInboxDrawer: undefined,
    toggleSidebar: undefined,
    toggleMargin: undefined,
  });
  return null;
}

function mount(path: string, withCommands = true) {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path={path}>
        {withCommands ? <Commands enabled /> : null}
        <Sidebar user={user as AuthenticatedUser} />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  const rows = [...view.container.querySelectorAll("nav > ul > li > a")];
  return rows.map((row) => ({
    label: row.querySelector("span")?.textContent,
    href: row.getAttribute("href"),
    hint: [...row.querySelectorAll("kbd")].map((kbd) => kbd.textContent).join(" "),
    current: row.getAttribute("aria-current"),
  }));
}

describe("the sidebar", () => {
  test("draws a row per nav destination, with its address, icon and G chord", () => {
    const rows = mount("/");
    expect(rows.map((row) => row.label)).toEqual(NAV_DESTINATIONS.map((d) => d.label));
    expect(rows.map((row) => row.href)).toEqual(
      NAV_DESTINATIONS.map((d) => NAV_PAGES[d.name].path)
    );
    expect(rows.map((row) => row.hint)).toEqual(["G I", "G A", "", "", "", "", "G S"]);
  });

  test("control: with no command mounted, no row claims a key", () => {
    expect(mount("/", false).every((row) => row.hint === "")).toBe(true);
  });

  test("marks the open destination, and keeps it lit on the pages under it", () => {
    const rows = mount("/priorities/7");
    expect(rows.filter((row) => row.current === "page").map((row) => row.label)).toEqual([
      "Priorities",
    ]);
  });
});
