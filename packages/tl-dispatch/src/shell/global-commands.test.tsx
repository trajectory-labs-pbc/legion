import { afterEach, describe, expect, test } from "bun:test";
import { appCatalog } from "@/commands/app-catalog";
import { UNDER_OVERLAY } from "@/commands/bindings";
import { appKeymap } from "@/upstream/keys";
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
    openAnswers: log("answers"),
    openMachineLogins: log("machine logins"),
    signOut: log("sign out"),
    toggleInboxDrawer: log("inbox drawer"),
    toggleSidebar: log("sidebar"),
    toggleMargin: { label: "Toggle margin", run: log("margin") },
    previewInbox: log("preview"),
    leaveInboxPreview: undefined,
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
  // The catalog's keys are upstream's shell keys and the frame's own (`upstream-keys.test.ts`).
  test("bind the catalog's global keys and no other", () => {
    setup();
    const ours = globalBindings().flatMap((binding) => binding.keys);
    const catalog = appCatalog.commandsOf("global").flatMap((command) => command.keys ?? []);
    expect(ours.filter((keys) => !catalog.includes(keys))).toEqual([]);
    expect(catalog.filter((keys) => !ours.includes(keys))).toEqual([]);
  });

  test("each key runs its action", () => {
    const { calls } = setup();
    press("k", { ctrlKey: true });
    press("/");
    press("?", { shiftKey: true });
    press("c");
    for (const letter of ["i", "a", "o", "e", "l", "m", "s", "n"]) {
      press("g");
      press(letter);
    }
    press("i");
    press("S", { shiftKey: true });
    press("[");
    press("M", { shiftKey: true });
    expect(calls).toEqual([
      "search",
      "search",
      "shortcuts",
      "create",
      "go inbox",
      "go agents",
      "go priorities",
      "go delivery",
      "go pipeline",
      "go machines",
      "go settings",
      "machine logins",
      "inbox drawer",
      "sidebar",
      "sidebar",
      "margin",
    ]);
  });

  test("an absent action shuts its gate: the key does nothing until it is given", () => {
    const { calls, rerender } = setup({ toggleInboxDrawer: undefined });
    const keys = () => {
      for (const keys of [["g", "d"], ["i"]]) for (const key of keys) press(key);
    };
    keys();
    expect(calls).toEqual([]);
    rerender({
      openDocuments: () => calls.push("documents"),
      toggleInboxDrawer: () => calls.push("drawer"),
    });
    keys();
    expect(calls).toEqual(["documents", "drawer"]);
  });

  // `n` starts chords, so a shut `g n` would hand its second press to one.
  test("G N always opens the machine login page, which says itself when it is not served", () => {
    const { calls } = setup();
    expect(globalBindings().find((binding) => binding.keys.includes("g n"))?.enabled).toBe(true);
    press("g");
    press("n");
    expect(calls).toEqual(["machine logins"]);
  });

  test("the palette offers Sign out only while no sign-out is under way", () => {
    const { calls, rerender } = setup({ signOut: undefined });
    const signOut = () => appKeymap.actions().find((action) => action.label === "Sign out");
    expect(signOut()).toBeUndefined();
    rerender({ signOut: () => calls.push("sign out") });
    signOut()?.run();
    expect(calls).toEqual(["sign out"]);
  });

  test("the palette offers the Inbox preview's two commands each only while it applies", () => {
    const { calls, rerender } = setup();
    const offered = () =>
      appKeymap
        .actions()
        .map((action) => action.label)
        .filter(
          (label) => label === "Preview the new Inbox" || label === "Leave the Inbox preview"
        );
    expect(offered()).toEqual(["Preview the new Inbox"]);
    appKeymap
      .actions()
      .find((action) => action.label === "Preview the new Inbox")
      ?.run();
    expect(calls).toEqual(["preview"]);
    rerender({ previewInbox: undefined, leaveInboxPreview: () => calls.push("leave") });
    expect(offered()).toEqual(["Leave the Inbox preview"]);
    appKeymap
      .actions()
      .find((action) => action.label === "Leave the Inbox preview")
      ?.run();
    expect(calls).toEqual(["preview", "leave"]);
  });

  test("Shift+M names what it opens", () => {
    const { rerender } = setup();
    const label = () => globalBindings().find((binding) => binding.keys.includes("Shift+M"))?.label;
    expect(label()).toBe("Toggle margin");
    rerender({ toggleMargin: { label: "Open or close Details", run: () => {} } });
    expect(label()).toBe("Open or close Details");
  });
});
