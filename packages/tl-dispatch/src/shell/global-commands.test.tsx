import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { appKeymap } from "@upstream-dispatch/features/shell/keymap";

import { UNDER_OVERLAY } from "@/commands/bindings";
import { keyRegistrations, UPSTREAM_WEB } from "../../tests/key-registrations";
import { render, settle } from "../../tests/react";
import { type GlobalActions, useGlobalCommands } from "./global-commands";

function Harness({ actions }: { actions: GlobalActions }) {
  useGlobalCommands(actions);
  return null;
}

function setup(overrides: Partial<GlobalActions> = {}) {
  const calls: string[] = [];
  const log = (name: string) => () => calls.push(name);
  const actions: GlobalActions = {
    openSearch: log("search"),
    toggleShortcuts: log("shortcuts"),
    createIssue: log("create"),
    goTo: (destination) => calls.push(`go ${destination}`),
    openDocuments: undefined,
    toggleInboxDrawer: log("inbox drawer"),
    toggleSidebar: log("sidebar"),
    toggleMargin: { label: "Toggle margin", run: log("margin") },
    ...overrides,
  };
  const view = render(<Harness actions={actions} />);
  mounted.push(view);
  return {
    calls,
    rerender: (next: Partial<GlobalActions>) =>
      view.rerender(<Harness actions={{ ...actions, ...next }} />),
  };
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

const press = (key: string, init: KeyboardEventInit = {}) =>
  settle(() => {
    appKeymap.handleKeyDown(new KeyboardEvent("keydown", { key, cancelable: true, ...init }));
  });

const globalBindings = () =>
  appKeymap
    .describe()
    .filter((binding) => binding.scope === "global" && !binding.id.endsWith(UNDER_OVERLAY));

describe("the shell's global commands", () => {
  test("bind upstream's shell keys and no other, so moving the shell onto the catalog changes no key", () => {
    setup();
    const ours = globalBindings().flatMap((binding) => binding.keys);
    const upstream = keyRegistrations(join(UPSTREAM_WEB, "app.tsx"))
      .filter((registration) => registration.scope === "global")
      .map((registration) => registration.keys);
    expect(ours.filter((keys) => !upstream.includes(keys))).toEqual([]);
    expect(upstream.filter((keys) => !ours.includes(keys))).toEqual([]);
  });

  test("each key runs its action", () => {
    const { calls } = setup();
    press("k", { ctrlKey: true });
    press("/");
    press("?", { shiftKey: true });
    press("c");
    for (const letter of ["i", "a", "s"]) {
      press("g");
      press(letter);
    }
    press("i");
    press("S", { shiftKey: true });
    press("M", { shiftKey: true });
    expect(calls).toEqual([
      "search",
      "search",
      "shortcuts",
      "create",
      "go inbox",
      "go agents",
      "go settings",
      "inbox drawer",
      "sidebar",
      "margin",
    ]);
  });

  test("an absent action shuts its gate: the key does nothing until it is given", () => {
    const { calls, rerender } = setup({ toggleInboxDrawer: undefined });
    press("g");
    press("d");
    press("i");
    expect(calls).toEqual([]);
    rerender({
      openDocuments: () => calls.push("documents"),
      toggleInboxDrawer: () => calls.push("drawer"),
    });
    press("g");
    press("d");
    press("i");
    expect(calls).toEqual(["documents", "drawer"]);
  });

  test("Shift+M names what it opens", () => {
    const { rerender } = setup();
    const label = () => globalBindings().find((binding) => binding.keys.includes("Shift+M"))?.label;
    expect(label()).toBe("Toggle margin");
    rerender({ toggleMargin: { label: "Open or close Details", run: () => {} } });
    expect(label()).toBe("Open or close Details");
  });
});
