import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";

import { act } from "react";

import { loadHotkeyTooltip } from "@/commands/hotkey-tooltip";
import { NAV_DESTINATIONS } from "@/commands/nav";
import { json, stubFetch, waitFor } from "../../tests/fetch";
import { INBOX_TWO_FOR_READER } from "../../tests/inbox";
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

const sleep = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

const user = { kind: "user", login: "reader" } as const satisfies Pick<
  AuthenticatedUser,
  "kind" | "login"
>;

function Commands({ enabled, onPeek }: { enabled: boolean; onPeek?: () => void }) {
  const run = () => {};
  useGlobalCommands({
    openSearch: run,
    toggleShortcuts: run,
    createIssue: run,
    goTo: enabled ? run : () => {},
    openDocuments: undefined,
    toggleInboxDrawer: onPeek,
    toggleSidebar: undefined,
    toggleMargin: undefined,
  });
  return null;
}

function mount(
  path: string,
  {
    answer,
    client = new QueryClient(),
    commands = true,
    onPeek,
    peek = false,
  }: {
    answer?: (url: string) => Response | undefined;
    client?: QueryClient;
    commands?: boolean;
    onPeek?: () => void;
    peek?: boolean;
  } = {}
) {
  if (answer !== undefined) mounted.push({ unmount: stubFetch(answer).restore });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryNavigationProvider path={path}>
        {commands ? <Commands enabled onPeek={onPeek} /> : null}
        <Sidebar peek={peek} user={user as AuthenticatedUser} />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  return view.container;
}

const PEEK = "Peek at the inbox without leaving this page";

/** Moves a mouse onto `element`, or off it with `leave`. */
function hover(element: Element, leave = false) {
  settle(() => {
    const [pointer, mouse] = leave
      ? ["pointerleave", "mouseleave"]
      : ["pointerenter", "mouseenter"];
    element.dispatchEvent(new PointerEvent(pointer, { bubbles: true, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent(mouse, { bubbles: true }));
    if (!leave) element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
  });
}

/** The open tooltip's text and its key chips. */
async function tooltipOf(element: Element) {
  hover(element);
  await sleep(700);
  const popup = document.querySelector('[data-slot="tooltip-content"]');
  const shown = {
    side: popup?.getAttribute("data-side"),
    text: popup?.textContent,
    keys: [...(popup?.querySelectorAll("kbd") ?? [])].map((kbd) => kbd.textContent),
  };
  hover(element, true);
  return shown;
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

function mountView(data: SidebarData) {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path="/">
        <SidebarView data={data} onNavigate={undefined} peek={false} />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  return view.container;
}

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
    const tooltip = await tooltipOf(inboxRow);
    expect(tooltip.side).toBe("right");
    expect(tooltip.text).toStartWith("Go to Inbox");
    expect(tooltip.keys).toEqual(["G", "I"]);
  });

  test("Peek sits at the Inbox row's edge, shown on its hover or focus, named with its key", async () => {
    await loadHotkeyTooltip();
    const peeked: string[] = [];
    const container = mount("/agents", { onPeek: () => peeked.push("peek"), peek: true });
    const peek = container.querySelector<HTMLButtonElement>(`[aria-label="${PEEK}"]`);
    if (peek === null) throw new Error("no Peek");
    expect(peek.closest("li")?.querySelector("a")?.getAttribute("href")).toBe("/");
    for (const shown of [
      "opacity-0",
      "group-hover/peek:opacity-100",
      "focus-within/peek:opacity-100",
    ]) {
      expect(peek.className).toContain(shown);
    }
    expect(peek.closest("li")?.querySelector("a")?.className).toContain("group-hover/peek:pr-9");
    const tooltip = await tooltipOf(peek);
    expect(tooltip.text).toStartWith("Peek");
    expect(tooltip.keys).toEqual(["I"]);
    settle(() => peek.click());
    expect(peeked).toEqual(["peek"]);
  });

  test("no Peek in the drawer, whose header has its own", () => {
    const drawer = mount("/agents", { onPeek: () => {}, peek: false });
    expect(drawer.querySelector(`[aria-label="${PEEK}"]`)).toBeNull();
  });

  test("no Peek, and no room for it, where the drawer cannot open", () => {
    const inbox = mount("/", { peek: true });
    expect(inbox.querySelector(`[aria-label="${PEEK}"]`)).toBeNull();
    expect(inbox.querySelector("nav a")?.className).not.toContain("pr-9");
  });

  test("control: with no command mounted, no row has a tooltip to give", () => {
    expect(mount("/", { commands: false }).querySelectorAll("kbd")).toHaveLength(0);
  });

  test("marks the open destination, and keeps it lit on the pages under it", () => {
    const rows = rowsOf(mount("/priorities/7"));
    expect(rows.filter((row) => row.current === "page").map((row) => row.label)).toEqual([
      "Priorities",
    ]);
  });

  test("the Inbox counts the asks waiting on the reader, not the unread threads", async () => {
    const container = mount("/agents", {
      answer: (url) => {
        if (url.endsWith("/auth/whoami")) return json({ kind: "user", login: "reader" });
        if (url.endsWith("/api/v1/inbox")) return json(INBOX_TWO_FOR_READER);
        if (url.includes("/api/v1/me/replies")) return json({ items: [], total: 3 });
        return undefined;
      },
    });
    const mark = () => container.querySelector('[data-slot="attention-mark"]');
    await waitFor(() => mark() !== null, sleep);
    expect(mark()?.getAttribute("aria-label")).toBe("Needs you: 2");
    expect(mark()?.closest("a")?.getAttribute("href")).toBe("/");
  });

  test("pinned agents fold under their heading, and with none it says how to pin one", () => {
    const container = mountView({
      destinations: [],
      pinnedAgents: [],
      inLiveView: false,
      pinnedIssues: { status: "success", rows: [] },
      projects: { status: "success", rows: [] },
    });
    const fold = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Pinned agents"
    );
    if (fold === undefined) throw new Error("no fold");
    const list = document.getElementById(fold.getAttribute("aria-controls") ?? "");
    expect(fold.getAttribute("aria-expanded")).toBe("true");
    expect(list?.hidden).toBe(false);
    expect(list?.textContent).toBe(
      "Pin an agent on the Agents page, or in its live view, to keep it here."
    );
    settle(() => fold.click());
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    expect(list?.hidden).toBe(true);
    settle(() => fold.click());
    expect(list?.hidden).toBe(false);
  });

  test("a read still out draws a quiet line; a failed one says so beside Retry", () => {
    const asked: string[] = [];
    const container = mountView({
      destinations: [
        destination("inbox", {
          count: undefined,
          needsYou: true,
          retry: () => asked.push("inbox"),
        }),
      ],
      pinnedAgents: [],
      inLiveView: false,
      pinnedIssues: { status: "pending" },
      projects: { status: "error", retry: () => asked.push("projects") },
    });
    const lines = [...container.querySelectorAll("p")];
    expect(lines.map((line) => line.textContent)).toEqual([
      "Could not load the Inbox count.Retry",
      "Pin an agent on the Agents page, or in its live view, to keep it here.",
      "Loading pinned issues…",
      "Could not load projects.Retry",
    ]);
    expect(lines[2]?.className).toContain("text-muted-foreground");
    for (const failed of [lines[0], lines[3]]) {
      expect(failed?.className).toContain("text-danger");
      settle(() => failed?.querySelector("button")?.click());
    }
    expect(asked).toEqual(["inbox", "projects"]);
  });

  test("Retry asks a failed section's read again and draws its rows", async () => {
    let projectReads = 0;
    const container = mount("/agents", {
      client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      answer: (url) => {
        if (!url.endsWith("/api/v1/projects")) return undefined;
        projectReads += 1;
        return projectReads === 1
          ? json({ error: { code: "INTERNAL" } }, 500)
          : json([{ key: "CORE", name: "Core", open_asks: 0 }]);
      },
    });
    const retry = () =>
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry");
    await waitFor(() => retry() !== undefined, sleep);
    expect(container.textContent).toContain("Could not load projects.");
    settle(() => retry()?.click());
    await waitFor(() => container.querySelector('a[href="/projects/CORE"]') !== null, sleep);
    expect(container.querySelector('a[href="/projects/CORE"]')?.textContent).toContain("Core");
    expect(retry()).toBeUndefined();
  });

  test("counts at the row's edge: the needs-you mark on the Inbox alone, the rest muted", () => {
    const data: SidebarData = {
      destinations: [
        destination("inbox", { count: 7, needsYou: true }),
        destination("agents", { count: 2, label: "2 unread replies" }),
        destination("priorities", { count: 3 }),
      ],
      pinnedAgents: [],
      inLiveView: false,
      pinnedIssues: { status: "success", rows: [] },
      projects: {
        status: "success",
        rows: [{ key: "CORE", text: "Core", openAsks: 4, current: false }],
      },
    };
    const container = mountView(data);
    const edges = [...container.querySelectorAll("a")].map((row) => row.lastElementChild);
    expect(edges.map((edge) => edge?.textContent)).toEqual(["7", "2", "3", "4"]);
    for (const edge of edges) expect(edge?.className).toContain("ml-auto");
    const marks = [...container.querySelectorAll('[data-slot="attention-mark"]')];
    expect(marks).toHaveLength(1);
    expect(edges[0]).toBe(marks[0]);
    expect(marks[0]?.getAttribute("aria-label")).toBe("Needs you: 7");
    for (const edge of edges.slice(1)) {
      expect(edge?.className).toContain("text-muted-foreground");
      expect(edge?.className).not.toContain("warning");
    }
    expect(edges[1]?.getAttribute("title")).toBe("2 unread replies");
  });
});
