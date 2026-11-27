import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { GlobalCommands } from "../../tests/global-shell";
import { INBOX_TWO_FOR_READER, inboxReads, unasked } from "../../tests/inbox";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { answerShellReads, json, waitFor } from "../../tests/network";
import { render, settle, tooltipOf } from "../../tests/react";
import { CompactHeader } from "./compact-header";

const PEEK = "Peek inbox";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

/** The shell reads the last `mount` was asked, in order. */
let answered: string[] = [];

function mount(
  children: ReactNode,
  answer: (url: string) => Response | undefined = () => undefined,
  client = new QueryClient()
) {
  answered = answerShellReads(answer).asked;
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryNavigationProvider path="/agents">
        <GlobalCommands />
        {children}
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  cleanups.push(() => view.unmount());
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
    expect(home.querySelector(`[aria-label="${PEEK}"]`)).toBeNull();
  });

  test("elsewhere the Inbox links home, beside a Peek at the inbox", () => {
    const away = mount(
      <CompactHeader navigationOpen={false} onInbox={false} onOpenNavigation={() => {}} />
    );
    const links = [...away.querySelectorAll("a")].map(
      (a) => `${a.textContent} ${a.getAttribute("href")}`
    );
    expect(links).toEqual(["Dispatch /", "Inbox /"]);
    // The name draws the app's focus ring, not the browser's.
    expect(away.querySelector("a")?.className).toContain("focus-visible:outline-focus");
    expect(away.querySelector('[aria-current="page"]')).toBeNull();
    expect(away.querySelector(`[aria-label="${PEEK}"]`)).not.toBeNull();
  });

  test("Peek has the catalog's one name and its own icon, and its tooltip shows the name with its key", async () => {
    const away = mount(
      <CompactHeader navigationOpen={false} onInbox={false} onOpenNavigation={() => {}} />
    );
    const peek = away.querySelector<HTMLButtonElement>(`[aria-label="${PEEK}"]`);
    if (peek === null) throw new Error("no Peek");
    expect(peek.textContent).toBe("");
    expect(peek.querySelector("svg")?.getAttribute("class")).toContain("lucide-eye");
    const tooltip = await tooltipOf(peek);
    expect(tooltip.text).toStartWith(PEEK);
    expect(tooltip.keys).toEqual(["I"]);
  });

  test("the Inbox counts what waits on the reader in the mark; unread agents are muted", async () => {
    const header = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />,
      (url) =>
        url.includes("/api/v1/me/agents/state")
          ? json({ one: { unread_replies: 2 } })
          : inboxReads(() => json(INBOX_TWO_FOR_READER), 3)(url)
    );
    const agentsLink = () => header.querySelector('a[href="/agents"]');
    const mark = () => header.querySelector('[data-slot="attention-mark"]');
    await waitFor(() => agentsLink() !== null && mark() !== null);
    // Two asks wait on the reader; the third waits on someone else, and unread threads are not counted.
    const marks = [...header.querySelectorAll('[data-slot="attention-mark"]')];
    expect(marks.map((mark) => mark.getAttribute("aria-label"))).toEqual(["Needs you: 2"]);
    expect(marks[0]?.closest("a")?.getAttribute("href")).toBe("/");
    const unread = agentsLink()?.lastElementChild;
    expect(unread?.textContent).toBe("2");
    expect(unread?.className).toContain("text-muted-foreground");
  });

  test("with nothing waiting on the reader, the Inbox shows its unread threads, muted", async () => {
    const header = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />,
      inboxReads(() => json([]), 3)
    );
    const count = () => header.querySelector('a[href="/"] [data-slot="count"]');
    await waitFor(() => count() !== null);
    expect(count()?.textContent).toBe("3");
    expect(header.querySelector('[data-slot="attention-mark"]')).toBeNull();
    // The row names its count on hover, as the Agents row does.
    expect(count()?.closest("a")?.getAttribute("title")).toBe("3 unread threads");
  });

  test("an Inbox read the server refuses shows its line with no Retry", async () => {
    const header = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />,
      inboxReads(() => json({ error: { code: "FORBIDDEN" } }, 403), 3),
      new QueryClient({ defaultOptions: { queries: { retry: false } } })
    );
    await waitFor(() => header.textContent?.includes("You cannot see the Inbox count.") === true);
    expect([...header.querySelectorAll("button")].some((b) => b.textContent === "Retry")).toBe(
      false
    );
  });

  test("an Inbox read the server cannot find shows its line with no Retry", async () => {
    const header = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />,
      inboxReads(() => json({ error: { code: "NOT_FOUND" } }, 404), 3),
      new QueryClient({ defaultOptions: { queries: { retry: false } } })
    );
    await waitFor(() => header.textContent?.includes("Could not find the Inbox count.") === true);
    expect([...header.querySelectorAll("button")].some((b) => b.textContent === "Retry")).toBe(
      false
    );
  });

  test("a failed Inbox count shows its failed line, whose Retry asks every read again", async () => {
    let failing = true;
    const header = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />,
      inboxReads(() => (failing ? json({ error: { code: "INTERNAL" } }, 500) : json([])), 3),
      new QueryClient({ defaultOptions: { queries: { retry: false } } })
    );
    const retry = () =>
      [...header.querySelectorAll("button")].find((b) => b.textContent === "Retry");
    const count = () => header.querySelector('a[href="/"] [data-slot="count"]');
    await waitFor(() => retry() !== undefined);
    expect(header.textContent).toContain("Could not load the Inbox count.");
    // The 44 px bar has no room for the sentence: it takes the line below.
    expect(header.querySelector("header")?.textContent).not.toContain("Could not load");
    expect(count()).toBeNull();
    answered.length = 0;
    failing = false;
    settle(() => retry()?.click());
    await waitFor(() => count() !== null);
    expect(unasked(answered)).toEqual([]);
    expect(count()?.textContent).toBe("3");
  });

  test("Menu, named by its text alone, says whether the navigation is open and opens it", () => {
    let opened = 0;
    const container = mount(
      <CompactHeader navigationOpen onInbox onOpenNavigation={() => (opened += 1)} />
    );
    const menu = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Menu"
    );
    expect(menu?.hasAttribute("aria-label")).toBe(false);
    expect(menu?.getAttribute("aria-expanded")).toBe("true");
    settle(() => menu?.click());
    expect(opened).toBe(1);
  });
});
