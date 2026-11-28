import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import userEvent from "@testing-library/user-event";
import { act, type ReactNode } from "react";
import { renderApp } from "../../tests/app";
import { GlobalCommands } from "../../tests/global-shell";
import { holdShellReads } from "../../tests/network";
import { settle } from "../../tests/react";
import { shellChunksArrive } from "../../tests/shell-chunks";
import { NavigationPanel } from "./navigation-panel";

const user = { kind: "user", login: "reader", event_head: "0" } as const;
const cleanups: (() => void)[] = [];
beforeAll(async () => {
  // The account's menu is its own chunk: draw it once, so each test starts with it in place.
  mount(panel({}));
  await shellChunksArrive();
  for (const cleanup of cleanups.splice(0)) cleanup();
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function mount(children: ReactNode) {
  holdShellReads();
  const view = renderApp(children, { path: "/agents" });
  cleanups.push(() => view.unmount());
  return view.container;
}

const buttonNamed = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll("button")].find(
    (button) => (button.getAttribute("aria-label") ?? button.textContent) === name
  );

const ACCOUNT = "Signed in as reader";

/** Opens the account's menu, drawn in a portal on the body, and gives its Sign out. */
async function openAccount(container: HTMLElement) {
  const account = buttonNamed(container, ACCOUNT);
  if (account === undefined) throw new Error("no account button");
  await userEvent.setup().click(account);
  return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent === "Sign out"
  );
}

/** The panel under every global command, which records its id in `fired` when it runs; while
 *  `pending`, the shell has shut Sign out, as it does during a sign-out. */
function panel(
  { fired, pending = false }: { fired?: string[]; pending?: boolean },
  compact = false,
  onClose = () => {}
) {
  return (
    <>
      <GlobalCommands fired={fired} shut={pending ? ["global.sign-out"] : []} />
      <NavigationPanel
        closeButtonRef={{ current: null }}
        compact={compact}
        onClose={onClose}
        user={user}
      />
    </>
  );
}

describe("NavigationPanel", () => {
  test("names the account, and its menu's Sign out runs the palette's Sign out command", async () => {
    const fired: string[] = [];
    const container = mount(panel({ fired }));
    // Two steps: no Sign out on the panel itself, and opening the menu signs nobody out.
    expect(buttonNamed(container, "Sign out")).toBeUndefined();
    const signOut = await openAccount(container);
    expect(fired).toEqual([]);
    settle(() => signOut?.click());
    expect(fired).toEqual(["global.sign-out"]);
  });

  test("the account's menu opens the reader's own page", async () => {
    const container = mount(panel({}));
    await openAccount(container);
    const page = [...document.body.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]')].find(
      (item) => item.textContent === "Your page"
    );
    expect(page?.getAttribute("href")).toBe("/people/reader");
  });

  test("while a sign-out is out, the account shows it is busy", () => {
    const idle = mount(panel({}));
    expect(buttonNamed(idle, ACCOUNT)?.hasAttribute("aria-busy")).toBe(false);
    // One panel at a time: each mounts the global commands.
    for (const cleanup of cleanups.splice(0)) cleanup();

    const busy = mount(panel({ pending: true }));
    expect(buttonNamed(busy, ACCOUNT)?.getAttribute("aria-busy")).toBe("true");
  });

  test("while a sign-out is out, the account's menu does not open", async () => {
    const busy = mount(panel({ pending: true }));
    expect(await openAccount(busy)).toBeUndefined();
  });

  test("wide, its name row offers search, new issue and hiding the sidebar, as icons", () => {
    const wide = mount(panel({}));
    const row = wide.querySelector("a")?.parentElement;
    for (const name of ["Search", "New issue", "Hide sidebar"]) {
      const button = buttonNamed(wide, name);
      expect(button?.parentElement).toBe(row);
      expect(button?.textContent).toBe("");
    }
    expect(row?.className).toContain("h-11");
  });

  test("names the account on one control, which announces its menu", () => {
    const container = mount(panel({}));
    expect(buttonNamed(container, ACCOUNT)?.getAttribute("aria-haspopup")).toBe("menu");
  });

  test("in a drawer, Close ends it, and there is no sidebar to hide", () => {
    let closed = 0;
    const narrow = mount(panel({}, true, () => (closed += 1)));
    expect(buttonNamed(narrow, "Hide sidebar")).toBeUndefined();
    settle(() => buttonNamed(narrow, "Close navigation")?.click());
    expect(closed).toBe(1);
  });

  test("opens the tooltips of its name row's buttons below, clear of the window and each other", async () => {
    const container = mount(panel({}));
    for (const name of ["Hide sidebar", "Search", "New issue"]) {
      const trigger = buttonNamed(container, name);
      if (trigger === undefined) throw new Error(`no ${name} button`);
      settle(() => {
        trigger.dispatchEvent(
          new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" })
        );
        trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        trigger.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 700)));
      settle(() => {});
      const popup = document.querySelector('[data-slot="tooltip-content"]');
      expect(popup?.textContent?.startsWith(name)).toBe(true);
      expect(popup?.getAttribute("data-side")).toBe("bottom");
      settle(() => {
        trigger.dispatchEvent(
          new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" })
        );
        trigger.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      });
    }
  });
});
