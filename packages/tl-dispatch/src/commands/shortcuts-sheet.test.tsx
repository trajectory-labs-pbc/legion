import { afterEach, describe, expect, test } from "bun:test";
import { appKeymap } from "@upstream-dispatch/features/shell/keymap";
import { act } from "react";

import { openAppLayer } from "../../tests/layers";
import { render, settle } from "../../tests/react";
import { specsFor } from "../../tests/specs";
import { appCatalog } from "./app-catalog";
import { ShortcutsSheet } from "./shortcuts-sheet";
import { ShortcutsSheetView } from "./shortcuts-sheet-view";
import { useRegisterCommands } from "./use-register-commands";
import { useShortcutsSheet } from "./use-shortcuts-sheet";

const globalSpecs = (toggle: () => void, disabled: readonly string[]) =>
  specsFor(appCatalog, "global", (command) => ({
    enabled: !disabled.includes(command.name),
    run: command.name === "help" ? toggle : () => ran.push(command.name),
  }));

/** The commands other than help that ran. */
const ran: string[] = [];

function Harness({ disabled = [] }: { disabled?: readonly string[] }) {
  const sheet = useShortcutsSheet();
  useRegisterCommands(appCatalog, "global", globalSpecs(sheet.toggle, disabled));
  return (
    <ShortcutsSheetView
      mac={false}
      onOpenChange={sheet.setOpen}
      open={sheet.open}
      sections={sheet.sections}
    />
  );
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) settle(cleanup);
  ran.length = 0;
});

function mount(disabled?: readonly string[]) {
  const view = render(<Harness disabled={disabled} />);
  cleanups.push(() => view.unmount());
}

function openLayer(kind: Parameters<typeof openAppLayer>[0]) {
  let close = () => {};
  settle(() => {
    close = openAppLayer(kind).close;
  });
  cleanups.push(close);
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  settle(() => {
    appKeymap.handleKeyDown(new KeyboardEvent("keydown", { key, cancelable: true, ...init }));
  });

const sheet = () => document.body.querySelector<HTMLElement>('[data-slot="sheet-content"]');

/** Each row as `label: keys`: caps joined by `+` in a step, `then` between steps, `|` between keys. */
const rows = () =>
  [...(sheet()?.querySelectorAll("li") ?? [])].map((row) => {
    const keys = [...row.querySelectorAll('[data-slot="kbd-sequence"]')].map((key) =>
      [...key.children]
        .map((part) => part.textContent)
        .join("+")
        .replaceAll("+then+", " then ")
    );
    return `${row.firstElementChild?.textContent}: ${keys.join(" | ")}`;
  });

const headings = () => [...(sheet()?.querySelectorAll("h3") ?? [])].map((h) => h.textContent);

describe("ShortcutsSheet", () => {
  test("? opens it on the page, grouped, with each live key once", () => {
    mount();
    expect(sheet()).toBeNull();
    press("?", { shiftKey: true });
    expect(sheet()?.querySelector("h2")?.textContent).toBe("Keyboard shortcuts");
    expect(headings()).toEqual(["General", "Help", "Navigation", "Layout"]);
    expect(rows()).toContain("Create issue: C");
    expect(rows()).toContain("Go to Inbox: G then I");
    expect(rows()).toContain("Show keyboard shortcuts: ?");
  });

  // A browser sends a key to the focused element, and the window's listener reads it there.
  const pressFocused = (key: string, init: KeyboardEventInit = {}) =>
    settle(() => {
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
      );
    });
  const listen = () => {
    const onKeyDown = (event: KeyboardEvent) => appKeymap.handleKeyDown(event);
    window.addEventListener("keydown", onKeyDown);
    cleanups.push(() => window.removeEventListener("keydown", onKeyDown));
  };
  const focusSettles = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  const closed = () => sheet()?.hasAttribute("data-closed") ?? true;

  test("focus lands on the sheet, not in the filter, so ? closes it", async () => {
    mount();
    listen();
    pressFocused("?", { shiftKey: true });
    await focusSettles();
    expect(document.activeElement?.getAttribute("data-slot")).toBe("sheet-content");
    pressFocused("?", { shiftKey: true });
    expect(closed()).toBe(true);
  });

  test("Escape closes it, pressed where the focus is", async () => {
    mount();
    listen();
    pressFocused("?", { shiftKey: true });
    await focusSettles();
    expect(closed()).toBe(false);
    pressFocused("Escape");
    await focusSettles();
    expect(closed()).toBe(true);
  });

  test("opens under a dialog or a sheet of ours, and not under an alert dialog", () => {
    mount();
    openLayer("overlay");
    press("?", { shiftKey: true });
    expect(sheet()).not.toBeNull();
    // Under our dialog only `under-all` commands run, so the global keys that stop there are not listed.
    expect(rows()).toEqual(["Show keyboard shortcuts: ?"]);
  });

  test("while it is open, no global key but ? runs: $mod+k opens no palette", () => {
    mount();
    press("?", { shiftKey: true });
    for (const [key, init] of [
      ["k", { ctrlKey: true }],
      ["/", {}],
      ["c", {}],
      ["i", {}],
      ["g", {}],
      ["a", {}],
    ] as const) {
      press(key, init);
    }
    expect(ran).toEqual([]);
    expect(sheet()?.hasAttribute("data-closed")).toBe(false);
    // Control: with the sheet closed, the same key runs.
    press("?", { shiftKey: true });
    press("k", { ctrlKey: true });
    expect(ran).toEqual(["search"]);
  });

  test("under a sheet of ours only ? is listed, as only ? runs there", () => {
    mount();
    openLayer("overlay");
    press("?", { shiftKey: true });
    expect(rows()).toEqual(["Show keyboard shortcuts: ?"]);
  });

  test("control: under an alert dialog ? does nothing", () => {
    mount();
    openLayer("alert-dialog");
    press("?", { shiftKey: true });
    expect(sheet()).toBeNull();
  });

  test("leaves out a disabled command, and lists it once enabled", () => {
    mount(["create"]);
    press("?", { shiftKey: true });
    expect(rows().some((row) => row.startsWith("Create issue"))).toBe(false);
    expect(rows().some((row) => row.startsWith("Command menu"))).toBe(true);
  });

  test("the filter narrows the rows and says when none match", () => {
    mount();
    press("?", { shiftKey: true });
    const input = sheet()?.querySelector("input");
    expect(input?.getAttribute("aria-label")).toBe("Filter shortcuts");
    const type = (value: string) =>
      settle(() => {
        if (input === null || input === undefined) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    type("sidebar");
    expect(rows()).toEqual(["Toggle sidebar: Shift+S"]);
    type("zzz");
    expect(rows()).toEqual([]);
    expect(sheet()?.textContent).toContain("No shortcut matches “zzz”.");
  });

  test("the shell's sheet loads its code on the first open, and draws nothing before", async () => {
    function Lazy() {
      const state = useShortcutsSheet();
      useRegisterCommands(appCatalog, "global", globalSpecs(state.toggle, []));
      return (
        <ShortcutsSheet onOpenChange={state.setOpen} open={state.open} sections={state.sections} />
      );
    }
    const view = render(<Lazy />);
    cleanups.push(() => view.unmount());
    expect(sheet()).toBeNull();
    press("?", { shiftKey: true });
    for (let tries = 0; tries < 20 && sheet() === null; tries += 1) {
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    expect(sheet()?.querySelector("h2")?.textContent).toBe("Keyboard shortcuts");
    // The sheet takes the focus a moment after it opens.
    await focusSettles();
  });
});
