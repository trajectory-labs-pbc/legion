import { afterEach, describe, expect, test } from "bun:test";
import { appKeymap } from "@upstream-dispatch/features/shell/keymap";

import { openAppLayer } from "../../tests/layers";
import { render, settle } from "../../tests/react";
import { appCatalog } from "./app-catalog";
import { useRegisterCommands } from "./bindings";
import { ShortcutsSheet, useShortcutsSheet } from "./shortcuts-sheet";
import { defineActions } from "./specs";

const useGlobalActions = defineActions(
  appCatalog,
  "global",
  ({ toggle, disabled }: { toggle: () => void; disabled: readonly string[] }, _options: null) =>
    Object.fromEntries(
      appCatalog.commandsOf("global").map((command) => [
        command.name,
        {
          enabled: !disabled.includes(command.name),
          run: command.name === "help" ? toggle : () => {},
        },
      ])
    )
);

function Harness({ disabled = [] }: { disabled?: readonly string[] }) {
  const sheet = useShortcutsSheet();
  useRegisterCommands(
    appCatalog,
    "global",
    useGlobalActions({ toggle: sheet.toggle, disabled }, null)
  );
  return (
    <ShortcutsSheet onOpenChange={sheet.setOpen} open={sheet.open} sections={sheet.sections} />
  );
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) settle(cleanup);
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

/** Each row as `label: chips`, chips joined by `+` within a key and `|` between keys. */
const rows = () =>
  [...(sheet()?.querySelectorAll("li") ?? [])].map((row) => {
    const keys = [...row.querySelectorAll(":scope > span:last-child > *")]
      .filter((part) => part.textContent !== "or")
      .map((part) =>
        [...(part.matches("kbd") ? [part] : part.querySelectorAll("kbd"))]
          .map((kbd) => kbd.textContent)
          .join("+")
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
    expect(rows()).toContain("Go to Inbox: G+I");
    expect(rows()).toContain("Keyboard shortcuts: ?");
  });

  test("? closes it again, and Escape closes it", () => {
    mount();
    press("?", { shiftKey: true });
    expect(sheet()).not.toBeNull();
    press("?", { shiftKey: true });
    expect(sheet()?.hasAttribute("data-closed") ?? true).toBe(true);
  });

  test("opens under a dialog or a sheet of ours, and not under an alert dialog", () => {
    mount();
    openLayer("dialog");
    press("?", { shiftKey: true });
    expect(sheet()).not.toBeNull();
    // Under our dialog only `under-all` commands run, so the global keys that stop there are not listed.
    expect(rows()).toEqual(["Keyboard shortcuts: ?"]);
  });

  test("under a sheet of ours it lists the globals that still run there", () => {
    mount();
    openLayer("sheet");
    press("?", { shiftKey: true });
    expect(rows()).toContain("Create issue: C");
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
    expect(rows().some((row) => row.startsWith("Search and actions"))).toBe(true);
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
});
