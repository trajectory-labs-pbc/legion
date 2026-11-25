import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";

import { act } from "react";

import { loadHotkeyTooltip } from "@/commands/hotkey-tooltip";
import { NAV_DESTINATIONS } from "@/commands/nav";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { render, settle } from "../../tests/react";
import { useGlobalCommands } from "./global-commands";
import { NAV_PAGES } from "./nav-pages";
import { Sidebar, SidebarView } from "./sidebar";
import type { SidebarData } from "./sidebar-data";

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
  return view.container;
}

function rowsOf(container: HTMLElement) {
  return [...container.querySelectorAll("nav > ul > li > a")].map((row) => ({
    row,
    label: row.querySelector("span")?.textContent,
    href: row.getAttribute("href"),
    current: row.getAttribute("aria-current"),
  }));
}

const destination = (name: string, count?: SidebarData["destinations"][number]["count"]) => {
  const found = NAV_DESTINATIONS.find((d) => d.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return {
    name: found.name,
    label: found.label,
    icon: found.icon,
    page: NAV_PAGES[found.name],
    current: false,
    count,
  };
};

describe("the sidebar", () => {
  test("draws a 28 px row per nav destination, with its address and icon", () => {
    const rows = rowsOf(mount("/"));
    expect(rows.map((row) => row.label)).toEqual(NAV_DESTINATIONS.map((d) => d.label));
    expect(rows.map((row) => row.href)).toEqual(
      NAV_DESTINATIONS.map((d) => NAV_PAGES[d.name].path)
    );
    for (const { row } of rows) expect(row.className).toContain("h-7");
  });

  test("shows no key at rest: a row's G chord is in its tooltip", async () => {
    await loadHotkeyTooltip();
    const container = mount("/");
    expect(container.querySelectorAll("kbd")).toHaveLength(0);
    const inboxRow = rowsOf(container)[0]?.row;
    if (inboxRow === undefined) throw new Error("no Inbox row");
    settle(() => {
      inboxRow.dispatchEvent(
        new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" })
      );
      inboxRow.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      inboxRow.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 700)));
    const popup = document.querySelector('[data-slot="tooltip-content"]');
    expect(popup?.getAttribute("data-side")).toBe("right");
    expect(popup?.textContent).toStartWith("Go to Inbox");
    expect([...(popup?.querySelectorAll("kbd") ?? [])].map((kbd) => kbd.textContent)).toEqual([
      "G",
      "I",
    ]);
    settle(() => {
      inboxRow.dispatchEvent(
        new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" })
      );
      inboxRow.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    });
  });

  test("control: with no command mounted, no row has a tooltip to give", () => {
    expect(mount("/", false).querySelectorAll("kbd")).toHaveLength(0);
  });

  test("marks the open destination, and keeps it lit on the pages under it", () => {
    const rows = rowsOf(mount("/priorities/7"));
    expect(rows.filter((row) => row.current === "page").map((row) => row.label)).toEqual([
      "Priorities",
    ]);
  });

  test("counts at the row's edge: muted, and the needs-you mark only for what waits on the reader", () => {
    const data: SidebarData = {
      destinations: [
        destination("inbox", { count: 7, needsYou: true }),
        destination("agents", { count: 0, needsYou: true }),
        destination("priorities", { count: 3 }),
      ],
      pinnedAgents: [],
      inLiveView: false,
      pinnedIssues: undefined,
      projects: [{ key: "CORE", text: "Core", openAsks: 4, current: false }],
    };
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryNavigationProvider path="/">
          <SidebarView data={data} onNavigate={undefined} />
        </MemoryNavigationProvider>
      </QueryClientProvider>
    );
    mounted.push(view);
    const counts = [...view.container.querySelectorAll('[data-slot="count"]')];
    expect(counts.map((count) => count.textContent)).toEqual(["7", "3", "4"]);
    expect(counts.map((count) => count.hasAttribute("data-needs-you"))).toEqual([
      true,
      false,
      false,
    ]);
    for (const count of counts) {
      expect(count.className).toContain("ml-auto");
      expect(count.parentElement?.lastElementChild).toBe(count);
    }
  });
});
