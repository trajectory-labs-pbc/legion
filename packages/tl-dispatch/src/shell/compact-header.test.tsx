import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { loadHotkeyTooltip } from "@/commands/hotkey-tooltip";
import { json, stubFetch, waitFor } from "../../tests/fetch";
import { GlobalCommands } from "../../tests/global-shell";
import { INBOX_TWO_FOR_READER, inboxReads, unasked } from "../../tests/inbox";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { render, settle, sleep } from "../../tests/react";
import { CompactHeader } from "./compact-header";

const PEEK = "Peek at the inbox without leaving this page";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function mount(
  children: ReactNode,
  answer: (url: string) => Response | undefined = () => undefined,
  client = new QueryClient()
) {
  const fetch = stubFetch(answer);
  const view = render(
    <QueryClientProvider client={client}>
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
    expect(away.querySelector('[aria-current="page"]')).toBeNull();
    expect(away.querySelector(`[aria-label="${PEEK}"]`)).not.toBeNull();
  });

  test("Peek is named for what it does, and its tooltip says Peek with its key", async () => {
    await loadHotkeyTooltip();
    const away = mount(
      <CompactHeader navigationOpen={false} onInbox={false} onOpenNavigation={() => {}} />
    );
    const peek = away.querySelector<HTMLButtonElement>(`[aria-label="${PEEK}"]`);
    if (peek === null) throw new Error("no Peek");
    expect(peek.textContent).toBe("");
    settle(() => {
      peek.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" }));
      peek.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      peek.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    });
    await sleep(700);
    const popup = document.querySelector('[data-slot="tooltip-content"]');
    expect(popup?.textContent).toStartWith("Peek");
    expect(popup?.textContent).not.toContain("inbox");
    expect([...(popup?.querySelectorAll("kbd") ?? [])].map((kbd) => kbd.textContent)).toEqual([
      "I",
    ]);
    settle(() => {
      peek.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" }));
      peek.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    });
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
    await waitFor(() => agentsLink() !== null && mark() !== null, sleep);
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
    await waitFor(() => count() !== null, sleep);
    expect(count()?.textContent).toBe("3");
    expect(header.querySelector('[data-slot="attention-mark"]')).toBeNull();
  });

  test("a failed Inbox count shows its failed line, whose Retry asks every read again", async () => {
    const asked: string[] = [];
    let failing = true;
    const answer = inboxReads(
      () => (failing ? json({ error: { code: "INTERNAL" } }, 500) : json([])),
      3
    );
    const header = mount(
      <CompactHeader navigationOpen={false} onInbox onOpenNavigation={() => {}} />,
      (url) => {
        asked.push(url);
        return answer(url);
      },
      new QueryClient({ defaultOptions: { queries: { retry: false } } })
    );
    const retry = () =>
      [...header.querySelectorAll("button")].find((b) => b.textContent === "Retry");
    const count = () => header.querySelector('a[href="/"] [data-slot="count"]');
    await waitFor(() => retry() !== undefined, sleep);
    expect(header.textContent).toContain("Could not load the Inbox count.");
    expect(count()).toBeNull();
    asked.length = 0;
    failing = false;
    settle(() => retry()?.click());
    await waitFor(() => count() !== null, sleep);
    expect(unasked(asked)).toEqual([]);
    expect(count()?.textContent).toBe("3");
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
