import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { quietConsoleError } from "@upstream-dispatch/__tests__/act-warnings";
import { answerRequests } from "@upstream-dispatch/__tests__/network";
import { userAgentStateQuery } from "@upstream-dispatch/api/queries";
import { liveViewsOf } from "@upstream-dispatch/features/agent-view/live-views";
import { readRecents } from "@upstream-dispatch/features/search/recents";
import { userPreferenceStorageKey } from "@upstream-dispatch/features/shell/userPreference";
import { http } from "msw";

import { commandStore } from "@/commands/command-store";
import { MemoryNavigationProvider, type Move } from "../../tests/navigation";
import { holdReads, holdShellReads, waitFor } from "../../tests/network";
import { render, settle, sleep } from "../../tests/react";
import { chunksArrive, shellChunksArrive } from "../../tests/shell-chunks";
import { setWidth } from "../../tests/viewport";
import { reader, signedInClient } from "../../tests/writes";
import { AppShell } from "./app-shell";
import { SignedInParts } from "./signed-in-parts";

beforeEach(() => {
  holdShellReads();
  // A sign-out is refused.
  answerRequests(http.post("/auth/logout", () => Response.json({}, { status: 403 })));
});

/** The narrow screen's Menu, named by its text alone. */
const menuButton = (root: HTMLElement) =>
  [...root.querySelectorAll("button")].find((button) => button.textContent === "Menu");

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0).reverse()) view.unmount();
  // The signed-in reader's preferences (a folded sidebar) and recents.
  window.localStorage.clear();
});

// An address whose page has no chunk, so none arrives while a test waits or after it.
async function mount(path = "/no-such-page", client = signedInClient(), move?: Move) {
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryNavigationProvider path={path} move={move}>
        <SignedInParts>
          <AppShell user={reader} />
        </SignedInParts>
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  mounted.push(view);
  await shellChunksArrive();
  return view;
}

/** Mounts the shell at `path`, and gives back the move to another address, as a followed link. */
async function mountMovable(path: string) {
  const move: Move = {};
  const view = await mount(path, signedInClient(), move);
  const moveTo = (to: string) =>
    settle(() => {
      if (move.to === undefined) throw new Error("the router has not handed over its move");
      move.to(to);
    });
  return { view, moveTo };
}

/** Presses a key on `target`, by default where the focus is, as a person does. */
const press = (
  init: KeyboardEventInit,
  target: Element = document.activeElement ?? document.body
) =>
  settle(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true })
    );
  });

const issuePageArrives = () =>
  chunksArrive(() => import("@upstream-dispatch/features/issue-page/IssuePage"));

/** Keeps the issue page's reads of AB-1 pending. */
const holdIssueReads = () =>
  holdReads("/api/v1/issues/AB-1", "/api/v1/issues/AB-1/*", "/api/v1/me/state");

describe("AppShell", () => {
  test("a refused sign-out still says so after the narrow screen's menu closes and opens", async () => {
    setWidth(375);
    await mount();
    // The menu is a sheet, drawn in a portal on the body.
    const click = (label: string) =>
      settle(() => {
        document.body.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.click();
      });
    const button = (text: string) =>
      [...document.body.querySelectorAll("button")].find((b) => b.textContent === text);
    settle(() => menuButton(document.body)?.click());
    const account = "Signed in as reader";
    await waitFor(() => button(account) !== undefined);
    const accountButton = button(account);
    if (accountButton === undefined) throw new Error("no account button");
    await userEvent.setup().click(accountButton);
    const signOut = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent === "Sign out"
    );
    settle(() => signOut?.click());
    // The menu closes; the corner says the sign-out is under way.
    expect(document.body.querySelector('[data-testid="signing-out"]')?.textContent).toBe(
      "Signing out…"
    );
    const alert = () => document.body.querySelector('[role="alert"]')?.textContent ?? "";
    // The sign-out first waits for the other tabs' answers.
    await waitFor(() => alert() !== "");
    expect(alert()).toContain("did not go through");
    click("Close navigation");
    await waitFor(() => button(account) === undefined);
    settle(() => menuButton(document.body)?.click());
    await waitFor(() => button(account) !== undefined);
    expect(alert()).toContain("did not go through");
  });

  test("a refused sign-out from the palette says so, with a Retry, while the sidebar is folded away", async () => {
    setWidth(1024);
    const view = await mount();
    settle(() => commandStore.run("global.toggle-sidebar"));
    expect(view.container.querySelector('[data-testid="sidebar"]')).toBeNull();
    settle(() => commandStore.run("global.sign-out"));
    const alert = () => document.body.querySelector('[role="alert"]');
    // The sign-out first waits for the other tabs' answers.
    await waitFor(() => alert() !== null);
    expect(alert()?.textContent).toContain("did not go through");
    expect(alert()?.querySelector("button")?.textContent).toBe("Retry");
  });

  test("? anywhere on the shell opens the shortcuts sheet, whose code loads then", async () => {
    await mount();
    press({ key: "?", shiftKey: true }, document.body);
    const sheet = () => document.body.querySelector('[data-slot="sheet-content"]');
    await waitFor(() => sheet() !== null);
    expect(sheet()?.querySelector("h2")?.textContent).toBe("Keyboard shortcuts");
    // The sheet takes the focus a moment after it opens.
    await sleep(50);
  });

  const foldKeys = [
    ["Shift+S", { key: "S", shiftKey: true }],
    ["[", { key: "[" }],
  ] as const;

  /** The shell's parts that a fold changes, on a viewport where the sidebar is a column. */
  async function foldable() {
    setWidth(768);
    const view = await mount();
    const part = (testId: string) =>
      view.container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const button = (name: string) =>
      view.container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
    return { part, button };
  }

  test.each(
    foldKeys
  )("%s folds the sidebar away: the panel fills the window under a row that shows it again", async (_key, init) => {
    const { part, button } = await foldable();
    expect(part("main-content")?.getAttribute("data-shell-layout")).toBe("standard");
    expect(part("panel-header")).toBeNull();
    expect(part("sidebar")?.className).toContain("w-(--sidebar-width)");
    expect(part("content-panel")?.className).not.toContain("md:ml-(--panel-inset)");
    press(init);
    expect(part("main-content")?.getAttribute("data-shell-layout")).toBe("full-width");
    expect(part("sidebar")).toBeNull();
    // Inset 8 px on all four sides, with a 44 px row on top that holds only Show sidebar and
    // stays in view while the page scrolls, over a strip that hides the page in the inset.
    expect(part("content-panel")?.className.split(" ")).toEqual(
      expect.arrayContaining(["md:ml-(--panel-inset)", "[--panel-row:--spacing(11)]"])
    );
    const row = part("panel-header");
    expect(row?.parentElement).toBe(part("content-panel"));
    expect(row?.className.split(" ")).toEqual(
      expect.arrayContaining([
        "h-(--panel-row)",
        "border-b",
        "sticky",
        "top-(--panel-inset)",
        "bg-card",
        "before:h-(--panel-inset)",
        "before:bg-background",
      ])
    );
    expect(
      [...(row?.querySelectorAll("button") ?? [])].map((b) => b.getAttribute("aria-label"))
    ).toEqual(["Show sidebar"]);
    press(init);
    expect(part("main-content")?.getAttribute("data-shell-layout")).toBe("standard");
    expect(part("panel-header")).toBeNull();
    expect(button("Show sidebar")).toBeNull();
  });

  test.each(
    foldKeys
  )("%s from inside the sidebar hands the focus to Show sidebar, and back to Hide sidebar", async (_key, init) => {
    const { part, button } = await foldable();
    settle(() => part("sidebar")?.querySelector<HTMLElement>("a[href]")?.focus());
    expect(part("sidebar")?.contains(document.activeElement)).toBe(true);
    // The focused button shows its tooltip, which places itself a moment later.
    const placed = () => sleep(50);
    press(init);
    expect(document.activeElement).toBe(button("Show sidebar"));
    await placed();
    press(init);
    expect(document.activeElement).toBe(button("Hide sidebar"));
    await placed();
  });

  test.each(foldKeys)("%s from the page leaves the focus where it is", async (_key, init) => {
    const { part } = await foldable();
    const main = part("main-content");
    settle(() => main?.focus());
    press(init);
    expect(part("sidebar")).toBeNull();
    expect(document.activeElement).toBe(main);
    press(init);
    expect(part("sidebar")).not.toBeNull();
    expect(document.activeElement).toBe(main);
  });

  test.each([
    767, 768,
  ])("below 768 px the navigation is a drawer under a top bar, and from 768 px a column: %i px", async (width) => {
    setWidth(width);
    const view = await mount();
    const column = view.container.querySelector('[data-testid="sidebar"]');
    const menu = menuButton(view.container);
    expect([column !== null, menu !== undefined]).toEqual(
      width < 768 ? [false, true] : [true, false]
    );
  });

  test("draws the inverted L: the sidebar on the window's ground, main in an inset rounded card", async () => {
    setWidth(1440);
    const view = await mount();
    const sidebar = view.container.querySelector('[data-testid="sidebar"]');
    const panel = view.container.querySelector('[data-testid="content-panel"]');
    expect(sidebar?.className).toContain("bg-background");
    expect(sidebar?.className).not.toContain("border-r");
    expect(panel?.contains(view.container.querySelector("main"))).toBe(true);
    for (const name of [
      "bg-card",
      "md:border",
      "md:rounded-lg",
      "md:my-(--panel-inset)",
      "md:mr-(--panel-inset)",
    ]) {
      expect(panel?.className.split(" ")).toContain(name);
    }
    expect(panel?.className).not.toContain("shadow");
    // The content is clipped to the corner, not the panel, whose sticky row reaches past its edges.
    expect(panel?.className).not.toContain("overflow-clip");
    expect(panel?.lastElementChild?.className.split(" ")).toEqual(
      expect.arrayContaining(["md:overflow-clip", "md:rounded-b-lg", "md:rounded-t-lg"])
    );
  });

  test("SHL-12 the issue a person opens joins their recent items", async () => {
    holdIssueReads();
    await mount("/issues/AB-1");
    await issuePageArrives();
    expect(readRecents(reader.login)).toEqual([{ label: "AB-1", path: "/issues/AB-1" }]);
  });

  test("SHL-27 a live view outlives its route: it stays mounted while the person is on another page", async () => {
    // The conversation's own reads.
    holdReads("/api/v1/agents/s-1/*");
    const { view, moveTo } = await mountMovable("/agents/s-1/live");
    const live = () =>
      view.container.querySelector<HTMLElement>('main [data-testid="agent-live-view"]');
    // The view's code loads when the first live view opens; until then it draws nothing.
    await waitFor(() => (live()?.childElementCount ?? 0) > 0);
    const opened = live();
    expect(opened?.dataset.front).toBe("true");
    moveTo("/no-such-page");
    expect(live()).toBe(opened);
    expect(opened?.dataset.front).toBe("false");
    // Back on its address, the same view is in front again, and stops lingering.
    moveTo("/agents/s-1/live");
    expect(live()).toBe(opened);
    expect(opened?.dataset.front).toBe("true");
  });

  test("SHL-28 from 1280 px the margin is a column beside the page", async () => {
    holdIssueReads();
    setWidth(1280);
    const view = await mount("/issues/AB-1");
    await issuePageArrives();
    const column = view.container.querySelector<HTMLElement>(
      '[data-testid="desktop-margin-shell"]'
    );
    expect(column?.hidden).toBe(false);
    // Upstream's column sits in the mark of upstream's views, which draws no box of its own.
    const mark = column?.parentElement;
    expect(mark?.matches(".contents[data-upstream-view]")).toBe(true);
    expect(mark?.parentElement).toBe(view.container.querySelector("main")?.parentElement);
  });

  /** The headings of the error fallbacks the shell draws, or those inside `within`. */
  const fallbacks = (view: { container: HTMLElement }, within = "") =>
    [...view.container.querySelectorAll(`${within} [data-testid="error-boundary"] h2`)].map(
      (heading) => heading.textContent
    );

  test("SHL-40 a page that fails to draw says so in main, the shell stays, and the next page clears it", async () => {
    quietConsoleError();
    holdIssueReads();
    // An issue the page cannot draw.
    answerRequests(http.get("/api/v1/issues/AB-1", () => Response.json(null)));
    setWidth(1440);
    const { view, moveTo } = await mountMovable("/issues/AB-1");
    await issuePageArrives();
    await waitFor(() => fallbacks(view, "main").length > 0);
    expect(fallbacks(view, "main")).toEqual(["Something went wrong in this page."]);
    expect(view.container.querySelector('[data-testid="sidebar"]')).not.toBeNull();
    moveTo("/no-such-page");
    expect(fallbacks(view, "main")).toEqual([]);
  });

  test("SHL-40 a margin that fails to draw says so in the margin, the page stays, and the next page clears it", async () => {
    quietConsoleError();
    holdIssueReads();
    // Comments in a shape the margin cannot draw.
    answerRequests(
      http.get("/api/v1/issues/AB-1/comments", () => Response.json({ comments: "none" }))
    );
    setWidth(1440);
    const { view, moveTo } = await mountMovable("/issues/AB-1");
    await issuePageArrives();
    await waitFor(() => fallbacks(view).length > 0);
    // Only the margin's: the page and the sidebar are still drawn.
    expect(fallbacks(view)).toEqual(["Something went wrong in the margin."]);
    expect(view.container.querySelector('[data-testid="sidebar"]')).not.toBeNull();
    moveTo("/no-such-page");
    expect(fallbacks(view)).toEqual([]);
  });

  test("SHL-44 an issue in the outline frame has the icon rail in the sidebar's place, which opens the navigation, and main fills the frame", async () => {
    holdIssueReads();
    window.localStorage.setItem(userPreferenceStorageKey(reader.login, "issue.page"), "outline");
    setWidth(1440);
    const view = await mount("/issues/AB-1");
    await issuePageArrives();
    const rail = view.container.querySelector('[data-testid="icon-rail"]');
    expect(rail).not.toBeNull();
    expect(view.container.querySelector('[data-testid="sidebar"]')).toBeNull();
    expect(view.container.querySelector("main")?.getAttribute("data-shell-layout")).toBe(
      "full-width"
    );
    // The navigation is a drawer here, and the rail opens it.
    settle(() => rail?.querySelector<HTMLElement>('[aria-label="Open navigation"]')?.click());
    const drawer = () => document.body.querySelector('[data-slot="sheet-content"][data-open]');
    // The drawer's code loads when it first opens, and it takes the focus a moment after.
    await waitFor(() => drawer()?.contains(document.activeElement) === true);
    expect(drawer()?.textContent).toContain("Signed in as reader");
  });

  // Each part's duty has its own test; these say only that the shell mounts the part.
  test("SHL-3 the shell gives its pages their contexts: the margin draws in them", async () => {
    const view = await mount();
    expect(view.container.querySelector('[data-testid="margin-sheet"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="error-boundary"]')).toBeNull();
  });

  test("SHL-13 the shell hands the live views the person's pins", async () => {
    const client = signedInClient();
    client.setQueryData(userAgentStateQuery().queryKey, {
      pinned: { pinned_at: "2026-11-01T00:00:00Z", unread_replies: 0 },
    });
    await mount(undefined, client);
    // A draft written and then emptied leaves a view that only a pin keeps.
    settle(() => {
      liveViewsOf(client).setDraft("pinned", "Hi");
      liveViewsOf(client).setDraft("pinned", "");
    });
    expect(Object.keys(window.__dispatchLiveViews?.views ?? {})).toEqual(["pinned"]);
  });

  test("SHL-15 the shell mounts its status corner", async () => {
    const view = await mount();
    expect(view.container.querySelector('[data-testid="connection-status"]')).not.toBeNull();
  });

  test("SHL-31 the skip link leads to main, which takes the focus, and draws the app's focus ring", async () => {
    const view = await mount();
    const skip = view.container.querySelector('a[href="#main-content"]');
    expect(skip?.className).toContain("focus-visible:outline-focus");
    const main = view.container.querySelector<HTMLElement>("#main-content");
    expect(main?.tagName).toBe("MAIN");
    expect(main?.getAttribute("tabindex")).toBe("-1");
  });

  test("$mod+k opens the search palette at once: a key typed next is the palette's", async () => {
    await mount();
    press({ key: "k", code: "KeyK", ctrlKey: true }, document.body);
    press({ key: "i", code: "KeyI" }, document.body);
    expect(document.body.querySelector('input[placeholder="Search Dispatch"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="inbox-drawer"]')).toBeNull();
  });

  describe("in the narrow screen's menu", () => {
    const menu = () => document.body.querySelector('[data-slot="sheet-content"][data-open]');
    const openMenu = async () => {
      setWidth(375);
      await mount();
      settle(() => menuButton(document.body)?.click());
      // The menu takes the focus a moment after it opens.
      await waitFor(() => menu()?.contains(document.activeElement) === true);
    };
    test("$mod+k opens the search palette and closes the menu", async () => {
      await openMenu();
      press({ key: "k", code: "KeyK", ctrlKey: true });
      expect(document.body.querySelector('input[placeholder="Search Dispatch"]')).not.toBeNull();
      await waitFor(() => menu() === null);
      expect(menu()).toBeNull();
    });

    test("a go-to chord closes the menu", async () => {
      await openMenu();
      press({ key: "g", code: "KeyG" });
      press({ key: "i", code: "KeyI" });
      await waitFor(() => menu() === null);
      expect(menu()).toBeNull();
    });

    test("SHL-11 i closes the menu and opens the inbox drawer", async () => {
      await openMenu();
      press({ key: "i", code: "KeyI" });
      await waitFor(() => menu() === null);
      expect(menu()).toBeNull();
      expect(document.body.querySelector('[data-testid="inbox-drawer"]')).not.toBeNull();
    });
  });
});
