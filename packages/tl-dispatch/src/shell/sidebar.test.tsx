import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";

import { NAV_DESTINATIONS } from "@/commands/nav";
import { compiledDeclarations } from "../../tests/design-rules";
import { INBOX_TWO_FOR_READER, inboxReads, unasked } from "../../tests/inbox";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { answerShellReads, holdShellReads, json, waitFor } from "../../tests/network";
import { render, settle, sleep, tooltipOf } from "../../tests/react";
import { useGlobalCommands } from "./global-commands";
import { NAV_PAGES } from "./nav-pages";
import { Sidebar, SidebarView } from "./sidebar";
import type { SectionRead, SidebarData } from "./sidebar-data";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
  window.localStorage.clear();
});

/** The section headings' fold buttons, by their words. */
const foldsOf = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLButtonElement>("section button[aria-expanded]"),
];
const headingsOf = (container: HTMLElement) => foldsOf(container).map((fold) => fold.textContent);
const openOf = (container: HTMLElement) =>
  foldsOf(container).map((fold) => fold.getAttribute("aria-expanded") === "true");
function foldOf(container: HTMLElement, heading: string): HTMLButtonElement {
  const fold = foldsOf(container).find((candidate) => candidate.textContent === heading);
  if (fold === undefined) throw new Error(`no ${heading} fold`);
  return fold;
}

const user = { kind: "user", login: "reader" } as const satisfies Pick<
  AuthenticatedUser,
  "kind" | "login"
>;

function Commands({ onPeek }: { onPeek?: () => void }) {
  const run = () => {};
  useGlobalCommands({
    openSearch: run,
    toggleShortcuts: run,
    createIssue: run,
    goTo: run,
    openDocuments: undefined,
    openAnswers: run,
    openMachineLogins: run,
    signOut: run,
    toggleInboxDrawer: onPeek,
    toggleSidebar: undefined,
    toggleMargin: undefined,
  });
  return null;
}

/** The shell reads the last `mount` with an `answer` was asked, in order. */
let answered: string[] = [];

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
  if (answer === undefined) holdShellReads();
  else answered = answerShellReads(answer).asked;
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryNavigationProvider path={path}>
        {commands ? <Commands onPeek={onPeek} /> : null}
        <Sidebar peek={peek} user={user as AuthenticatedUser} />
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  return view.container;
}

const PEEK = "Peek inbox";

function rowsOf(container: HTMLElement) {
  return [...container.querySelectorAll("nav > ul > li > a")].map((row) => ({
    row,
    label: row.querySelector("span")?.textContent,
    href: row.getAttribute("href"),
    current: row.getAttribute("aria-current"),
  }));
}

const readOf = <T,>(rows: readonly T[]): SectionRead<T> => ({ rows, fault: undefined });
const OUT = { rows: undefined, fault: undefined };
const faultOf = (retry: () => void) => ({ retrying: false, retry });
const failedRead = (retry: () => void) => ({ rows: undefined, fault: faultOf(retry) });
const PROJECT = { key: "CORE", text: "Core", openAsks: 0, current: false };

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
  // A pinned agent's row reads the agents for its name.
  holdShellReads();
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
    for (const { row } of rows) expect(row.className).toContain("h-control-sm");
  });

  test("shows no key at rest: a row's G chord is in its tooltip", async () => {
    const container = mount("/");
    expect(container.querySelectorAll("kbd")).toHaveLength(0);
    const inboxRow = rowsOf(container)[0]?.row;
    if (inboxRow === undefined) throw new Error("no Inbox row");
    const tooltip = await tooltipOf(inboxRow);
    expect(tooltip.side).toBe("right");
    expect(tooltip.text).toBe("Go to InboxGthenI");
    expect(tooltip.keys).toEqual(["G", "I"]);
  });

  test("Peek takes the Inbox count's box on the row's hover or focus, named with its key", async () => {
    const peeked: string[] = [];
    const container = mount("/agents", { onPeek: () => peeked.push("peek"), peek: true });
    const peek = container.querySelector<HTMLButtonElement>(`[aria-label="${PEEK}"]`);
    if (peek === null) throw new Error("no Peek");
    expect(peek.closest("li")?.querySelector("a")?.getAttribute("href")).toBe("/");
    for (const shown of [
      "opacity-0",
      "group-hover/peek:opacity-100",
      "group-focus-within/peek:opacity-100",
      "pointer-coarse:opacity-100",
    ]) {
      expect(peek.className).toContain(shown);
    }
    expect(peek.className).toContain("right-0");
    // A touch screen shows Peek beside the count; a mouse's hover puts it over the count.
    const link = peek.closest("li")?.querySelector("a");
    expect(link?.className).toContain("pointer-coarse:pr-9");
    expect(link?.className).not.toContain("group-hover/peek:pr-9");
    const tooltip = await tooltipOf(peek);
    expect(tooltip.text).toStartWith(PEEK);
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
      answer: inboxReads(() => json(INBOX_TWO_FOR_READER), 3),
    });
    const mark = () => container.querySelector('[data-slot="attention-mark"]');
    await waitFor(() => mark() !== null);
    expect(mark()?.getAttribute("aria-label")).toBe("Needs you: 2");
    // The row's key tooltip covers the mark: a native title would draw a second one.
    expect(mark()?.hasAttribute("title")).toBe(false);
    expect(mark()?.closest("a")?.getAttribute("href")).toBe("/");
  });

  test("a pinned agent's link is its 28 px row and carries current; Unpin fits beside it", () => {
    const container = mountView({
      destinations: [],
      pinnedAgents: readOf([{ sessionId: "s-1", selected: true, unread: 0 }]),
      inLiveView: false,
      pinnedIssues: readOf([]),
      projects: readOf([]),
    });
    const unpin = [...container.querySelectorAll("button")].find((button) =>
      /^Unpin .+ from the sidebar$/.test(button.getAttribute("aria-label") ?? "")
    );
    expect(unpin?.getAttribute("data-size")).toBe("icon-xs");
    expect(unpin?.getAttribute("aria-pressed")).toBe("true");
    // The app's tooltip names Unpin, not the browser's.
    expect(unpin?.hasAttribute("title")).toBe(false);
    const link = unpin?.closest("li")?.querySelector("a");
    expect(link?.className).toContain("h-control-sm");
    expect(link?.getAttribute("aria-current")).toBe("page");
    expect(unpin?.closest("li")?.hasAttribute("aria-current")).toBe(false);
  });

  test("pinned agents fold under their heading", () => {
    const container = mountView({
      destinations: [],
      pinnedAgents: readOf([{ sessionId: "s-1", selected: false, unread: 0 }]),
      inLiveView: false,
      pinnedIssues: readOf([]),
      projects: readOf([]),
    });
    const fold = foldOf(container, "Pinned agents");
    // Folded, the heading controls nothing, so the list's id is read while it shows.
    const id = fold.getAttribute("aria-controls") ?? "";
    const list = () => document.getElementById(id);
    expect(fold.getAttribute("aria-expanded")).toBe("true");
    expect(list()?.querySelector("a")).not.toBeNull();
    settle(() => fold.click());
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    expect(list()).toBeNull();
    settle(() => fold.click());
    expect(list()?.querySelector("a")).not.toBeNull();
  });

  test("a failed count is a danger icon in its box that retries; a failed section says so beside Retry", () => {
    const asked: string[] = [];
    const failed = (name: string) => () => asked.push(name);
    const container = mountView({
      destinations: [
        destination("inbox", { count: undefined, needsYou: true, fault: faultOf(failed("inbox")) }),
        destination("agents", { count: undefined, fault: faultOf(failed("agents")) }),
        destination("priorities", { count: undefined, fault: faultOf(failed("priorities")) }),
      ],
      pinnedAgents: failedRead(failed("pinned agents")),
      inLiveView: false,
      pinnedIssues: failedRead(failed("pinned issues")),
      projects: failedRead(failed("projects")),
    });
    const counts = [
      ...container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Could not load"]'),
    ];
    expect(counts.map((count) => count.getAttribute("aria-label"))).toEqual([
      "Could not load the Inbox count. Retry",
      "Could not load the Agents count. Retry",
      "Could not load the Priorities count. Retry",
    ]);
    for (const count of counts) {
      expect(count.getAttribute("data-variant")).toBe("quiet-danger");
      expect(count.querySelector("svg.lucide-circle-alert")).not.toBeNull();
      // In the count's box at the row's edge, over the link, not inside it.
      expect(count.className).toContain("absolute top-0 right-0");
      expect(count.closest("a")).toBeNull();
      expect(count.closest("li")?.className).toContain("relative");
      settle(() => count.click());
    }
    const alerts = [...container.querySelectorAll('[role="alert"]')];
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      "Could not load pinned agents.Retry",
      "Could not load pinned issues.Retry",
      "Could not load projects.Retry",
    ]);
    for (const alert of alerts) settle(() => alert.querySelector("button")?.click());
    expect(asked).toEqual([
      "inbox",
      "agents",
      "priorities",
      "pinned agents",
      "pinned issues",
      "projects",
    ]);
  });

  test("every pinned section draws nothing while out or empty", async () => {
    const container = mountView({
      destinations: [],
      pinnedAgents: OUT,
      inLiveView: false,
      pinnedIssues: OUT,
      projects: OUT,
    });
    await sleep(250);
    expect(headingsOf(container)).toEqual([]);
    for (const view of mounted.splice(0)) view.unmount();
    const empty = mountView({
      destinations: [],
      pinnedAgents: readOf([]),
      inLiveView: false,
      pinnedIssues: readOf([]),
      projects: readOf([]),
    });
    expect(headingsOf(empty)).toEqual([]);
  });

  test("every section's heading folds it, and this browser keeps the fold", () => {
    const data: SidebarData = {
      destinations: [],
      pinnedAgents: readOf([]),
      inLiveView: false,
      pinnedIssues: readOf([{ key: "CORE-1", text: "One", openAsks: 0, current: false }]),
      projects: readOf([PROJECT]),
    };
    const first = mountView(data);
    expect(headingsOf(first)).toEqual(["Pinned", "Projects"]);
    for (const heading of ["Pinned", "Projects"]) settle(() => foldOf(first, heading).click());
    expect(openOf(first)).toEqual([false, false]);
    for (const view of mounted.splice(0)) view.unmount();
    expect(openOf(mountView(data))).toEqual([false, false]);
  });

  test("a browser that refuses storage still folds a section", () => {
    const kept = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("refused", "SecurityError");
      },
    });
    try {
      const container = mountView({
        destinations: [],
        pinnedAgents: readOf([]),
        inLiveView: false,
        pinnedIssues: readOf([]),
        projects: readOf([PROJECT]),
      });
      settle(() => foldOf(container, "Projects").click());
      expect(openOf(container)).toEqual([false]);
    } finally {
      if (kept === undefined) Reflect.deleteProperty(window, "localStorage");
      else Object.defineProperty(window, "localStorage", kept);
    }
  });

  test("while Retry asks again, the failure stays and its Retry shows it is busy", async () => {
    let projectReads = 0;
    const container = mount("/agents", {
      client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      answer: (url) => {
        if (!url.endsWith("/api/v1/projects")) return undefined;
        projectReads += 1;
        return projectReads === 1 ? json({ error: { code: "INTERNAL" } }, 500) : undefined;
      },
    });
    const retry = () =>
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry");
    await waitFor(() => retry() !== undefined);
    settle(() => retry()?.click());
    await waitFor(() => retry()?.getAttribute("aria-busy") === "true");
    expect(container.textContent).toContain("Could not load projects.");
    expect(projectReads).toBe(2);
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
    await waitFor(() => retry() !== undefined);
    expect(container.textContent).toContain("Could not load projects.");
    settle(() => retry()?.click());
    await waitFor(() => container.querySelector('a[href="/projects/CORE"]') !== null);
    expect(container.querySelector('a[href="/projects/CORE"]')?.textContent).toContain("Core");
    expect(retry()).toBeUndefined();
  });

  test("a failed agent state is one failure, on the Agents row: no pinned agents section for it", async () => {
    const container = mount("/inbox", {
      client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      answer: (url) =>
        url.endsWith("/api/v1/me/agents/state")
          ? json({ error: { code: "INTERNAL" } }, 500)
          : undefined,
    });
    const agentsRetry = '[aria-label="Could not load the Agents count. Retry"]';
    await waitFor(() => container.querySelector(agentsRetry) !== null);
    expect(container.querySelectorAll('[aria-label$=". Retry"], [role="alert"]')).toHaveLength(1);
    expect(headingsOf(container)).not.toContain("Pinned agents");
  });

  /** Mounts the sidebar on the inbox `inbox` answers and `unread` unread threads, once both are asked. */
  async function mountInbox(inbox: () => Response | undefined, unread: number, peek = false) {
    const container = mount("/agents", {
      client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      onPeek: () => {},
      peek,
      answer: inboxReads(inbox, unread),
    });
    const counted = () =>
      new Set(
        answered.filter(
          (url) => url.endsWith("/api/v1/inbox") || url.includes("/api/v1/me/replies")
        )
      );
    await waitFor(() => counted().size === 2);
    await sleep(150);
    return container.querySelector('nav a[href="/"]');
  }
  const INBOX_RETRY = "Could not load the Inbox count. Retry";
  const numberOf = (row: Element | null) =>
    row?.querySelector('[data-slot="attention-mark"], [data-slot="count"]') ?? null;

  test("with nothing waiting on the reader, the Inbox shows its unread threads, muted", async () => {
    const inboxRow = await mountInbox(() => json(INBOX_TWO_FOR_READER.slice(2)), 3);
    expect(inboxRow?.querySelector('[data-slot="attention-mark"]')).toBeNull();
    const count = inboxRow?.querySelector('[data-slot="count"]');
    expect(count?.textContent).toBe("3");
    expect(count?.hasAttribute("title")).toBe(false);
    expect(count?.className).toContain("text-muted-foreground");
  });

  test("under Peek the Inbox count fades, so the link's name keeps it, and a touch screen shows it", async () => {
    const inboxRow = await mountInbox(() => json(INBOX_TWO_FOR_READER), 3, true);
    expect(inboxRow).toBe(screen.getByRole("link", { name: "Inbox Needs you: 2" }));
    const mark = inboxRow?.querySelector('[data-slot="attention-mark"]');
    const underPeek = mark?.className.split(" ").filter((name) => name.includes("/peek:")) ?? [];
    expect(underPeek).toHaveLength(2);
    // Hover and focus only fade it, and never where a touch screen shows Peek beside it.
    const compiled = await compiledDeclarations(underPeek);
    expect(compiled.map(({ property, value, context }) => [property, value, context[0]])).toEqual(
      underPeek.map(() => ["opacity", "0%", "@media not (pointer: coarse)"])
    );
  });

  test("with nothing waiting and nothing unread, the Inbox shows no number", async () => {
    const inboxRow = await mountInbox(() => json([]), 0);
    expect(inboxRow?.textContent).toBe("Inbox");
    expect(numberOf(inboxRow)).toBeNull();
  });

  test("until the inbox is read, the Inbox shows no number, not the unread count", async () => {
    expect(numberOf(await mountInbox(() => undefined, 3))).toBeNull();
  });

  test("a failed inbox read shows no unread count in its place", async () => {
    const inboxRow = await mountInbox(() => json({ error: { code: "INTERNAL" } }, 500), 3);
    expect(numberOf(inboxRow)).toBeNull();
    expect(inboxRow?.closest("li")?.querySelector(`[aria-label="${INBOX_RETRY}"]`)).not.toBeNull();
  });

  /** Mounts the sidebar on reads `answer` gives, once the Inbox count has failed. */
  async function mountFailedInbox(answer: (url: string) => Response | undefined) {
    const container = mount("/agents", {
      client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      answer,
    });
    const retry = () =>
      container
        .querySelector('nav a[href="/"]')
        ?.closest("li")
        ?.querySelector<HTMLButtonElement>(`[aria-label="${INBOX_RETRY}"]`) ?? undefined;
    await waitFor(() => retry() !== undefined);
    return { container, retry };
  }

  test("the Inbox count's Retry asks every read the count needs again", async () => {
    let failing = true;
    const { container, retry } = await mountFailedInbox(
      inboxReads(
        () => (failing ? json({ error: { code: "INTERNAL" } }, 500) : json(INBOX_TWO_FOR_READER)),
        3
      )
    );
    const mark = () => container.querySelector('[data-slot="attention-mark"]');
    answered.length = 0;
    failing = false;
    settle(() => retry()?.click());
    await waitFor(() => mark() !== null);
    expect(unasked(answered)).toEqual([]);
    expect(mark()?.getAttribute("aria-label")).toBe("Needs you: 2");
  });

  test("with no secrets broker, the Inbox count's Retry leaves the credential list unasked", async () => {
    let failing = true;
    const reads = inboxReads(
      () => (failing ? json({ error: { code: "INTERNAL" } }, 500) : json(INBOX_TWO_FOR_READER)),
      3
    );
    // A deployment with no broker answers the list with null, which upstream never asks again.
    const { container, retry } = await mountFailedInbox((url) =>
      url.includes("/api/v1/credential-requests") ? json(null) : reads(url)
    );
    const mark = () => container.querySelector('[data-slot="attention-mark"]');
    answered.length = 0;
    failing = false;
    settle(() => retry()?.click());
    await waitFor(() => mark() !== null);
    expect(unasked(answered)).toEqual(["/api/v1/credential-requests"]);
  });

  test("counts at the row's edge: the needs-you mark on the Inbox alone, the rest muted", () => {
    const data: SidebarData = {
      destinations: [
        destination("inbox", { count: 7, needsYou: true }),
        destination("agents", { count: 2 }),
        destination("priorities", { count: 3 }),
      ],
      pinnedAgents: readOf([]),
      inLiveView: false,
      pinnedIssues: readOf([]),
      projects: readOf([{ key: "CORE", text: "Core", openAsks: 4, current: false }]),
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
  });
});
