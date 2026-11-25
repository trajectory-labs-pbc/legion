import { describe, expect, test } from "bun:test";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@legion/ui/components/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@legion/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@legion/ui/components/select";
import {
  appKeymap,
  DIALOG_SCOPE,
  type Keymap,
  useKeymap,
  useKeymapScope,
} from "@upstream-dispatch/features/shell/keymap";

import { press, registerContext } from "../../tests/keymap";
import { openAppLayer } from "../../tests/layers";
import { mount } from "../../tests/mount";
import { settle } from "../../tests/react";
import { specsFor } from "../../tests/specs";
import { until } from "../../tests/wait";
import { appCatalog } from "./app-catalog";
import { contextBindings, UNDER_OVERLAY } from "./bindings";
import { commandStore } from "./command-store";
import { type CommandSpecs, createCatalog } from "./schema";
import { useRegisterCommands } from "./use-register-commands";

const catalog = createCatalog([
  {
    name: "global",
    parent: null,
    scope: "global",
    commands: [
      {
        name: "search",
        label: "Search",
        keys: ["$mod+k", "/"],
        inEditable: true,
        hideFrom: ["palette"],
      },
      { name: "create", label: "Create issue", keys: ["c", "n i"] },
      { name: "go-inbox", label: "Go to Inbox", keys: ["g i"] },
      { name: "help", label: "Keyboard shortcuts", keys: ["?"], overlays: "under-all" },
    ],
  },
]);

function recorder(context: string, fired: string[], enabled = true): CommandSpecs {
  return specsFor(catalog, context, (command) => ({ run: () => fired.push(command.id), enabled }));
}

/** A key engine with the global context registered as the shell will, and what it ran. */
function setup(enabled = true) {
  const fired: string[] = [];
  return { ...registerContext(catalog, "global", recorder("global", fired, enabled)), fired };
}

/** What upstream's palette does when it opens: push a dialog, then bind `$mod+k` to close. */
function openUpstreamPalette(keymap: Keymap, fired: string[]): () => void {
  const pop = keymap.pushScope(DIALOG_SCOPE);
  const off = keymap.register(DIALOG_SCOPE, [
    {
      id: "search-close",
      keys: "$mod+k",
      label: "Close",
      inEditable: true,
      run: () => fired.push("palette.close"),
    },
  ]);
  return () => {
    off();
    pop();
  };
}

describe("bindings", () => {
  test("carry the catalog's typing and palette fields", () => {
    const { stack } = setup();
    const [search, typed, create] = contextBindings(
      catalog,
      "global",
      recorder("global", []),
      stack
    ).own;
    expect(search).toMatchObject({ id: "global.search", keys: ["$mod+k"], inEditable: true });
    expect([search?.palette, create?.palette]).toEqual([false, true]);
    expect(typed).toMatchObject({ id: "global.search:typed-keys", keys: ["/"], palette: false });
    expect(typed?.inEditable).toBeUndefined();
    expect(create?.when?.()).toBe(true);
  });

  test("a copy under overlays reads the overlays open on every press", () => {
    const { layers, stack } = setup();
    const copy = contextBindings(
      catalog,
      "global",
      recorder("global", []),
      stack
    ).underOverlays.find(({ binding }) => binding.id === `global.create${UNDER_OVERLAY}`);
    expect(copy?.binding.when?.()).toBe(false);
    const sheet = layers.open("passthrough");
    expect(copy?.binding.when?.()).toBe(true);
    sheet.close();
    expect(copy?.binding.when?.()).toBe(false);
  });

  test("a typing command's keys fire in a field, but a key that types a character types it", () => {
    const { keymap, fired } = setup();
    const field = document.createElement("input");
    document.body.append(field);
    try {
      const inField = (key: string, init: KeyboardEventInit = {}) =>
        field.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true, ...init }));
      const handle = (event: Event) => {
        if (event instanceof KeyboardEvent) keymap.handleKeyDown(event);
      };
      field.addEventListener("keydown", handle);
      expect(inField("/")).toBe(true);
      inField("k", { ctrlKey: true });
      expect(fired).toEqual(["global.search"]);
      press(keymap, "/");
      expect(fired).toEqual(["global.search", "global.search"]);
    } finally {
      field.remove();
    }
  });

  test("a shut command neither fires nor shadows", () => {
    const { keymap, fired } = setup(false);
    press(keymap, "c");
    expect(fired).toEqual([]);
  });
});

describe("global commands under overlays", () => {
  test("run with nothing open", () => {
    const { keymap, fired } = setup();
    press(keymap, "c");
    press(keymap, "g");
    press(keymap, "i");
    expect(fired).toEqual(["global.create", "global.go-inbox"]);
  });

  test("run under an overlay of ours that passes them, and stop under any other", () => {
    const { keymap, layers, fired } = setup();
    for (const kind of ["overlay", "passthrough", "alert-dialog"] as const) {
      const layer = layers.open(kind);
      press(keymap, "c");
      layer.close();
    }
    expect(fired).toEqual(["global.create"]);
  });

  test("the help key reaches under every overlay of ours but an alert dialog, and not upstream's", () => {
    const { keymap, layers, fired } = setup();
    for (const kind of ["overlay", "passthrough", "alert-dialog"] as const) {
      const layer = layers.open(kind);
      press(keymap, "?", { shiftKey: true });
      layer.close();
    }
    const close = keymap.pushScope(DIALOG_SCOPE);
    press(keymap, "?", { shiftKey: true });
    close();
    expect(fired).toEqual(Array(2).fill("global.help"));
  });

  test("only a global command reaches under overlays", () => {
    expect(() =>
      createCatalog([
        { name: "global", parent: null, scope: "global", commands: [] },
        {
          name: "page",
          parent: "global",
          scope: "inbox",
          commands: [{ name: "x", label: "X", keys: ["x"], overlays: "under-all" }],
        },
      ])
    ).toThrow('"page.x": only a global command reaches under overlays');
  });

  test("stop under a drawer once one of upstream's dialogs is open, above it or below", () => {
    const { keymap, layers, fired } = setup();
    const sheet = layers.open("passthrough");
    const closeAbove = keymap.pushScope(DIALOG_SCOPE);
    press(keymap, "c");
    closeAbove();
    sheet.close();
    const closeBelow = keymap.pushScope(DIALOG_SCOPE);
    const above = layers.open("passthrough");
    press(keymap, "c");
    above.close();
    closeBelow();
    press(keymap, "c");
    expect(fired).toEqual(["global.create"]);
  });

  test("leave `$mod+k` to upstream's palette when it opens above a drawer of ours", () => {
    const { keymap, layers, fired } = setup();
    const sheet = layers.open("passthrough");
    press(keymap, "k", { ctrlKey: true });
    const closePalette = openUpstreamPalette(keymap, fired);
    press(keymap, "k", { ctrlKey: true });
    closePalette();
    sheet.close();
    expect(fired).toEqual(["global.search", "palette.close"]);
  });
});

describe("useRegisterCommands on the app's engine", () => {
  const appSpecs = (fired: string[]) => {
    return specsFor(appCatalog, "global", (command) => ({ run: () => fired.push(command.id) }));
  };

  function Shell({ fired }: { fired: string[] }) {
    useRegisterCommands(appCatalog, "global", appSpecs(fired));
    return null;
  }

  function UpstreamPalette({ fired }: { fired: string[] }) {
    useKeymapScope(DIALOG_SCOPE);
    useKeymap(DIALOG_SCOPE, [
      {
        id: "search-close",
        inEditable: true,
        keys: "$mod+k",
        label: "Close",
        run: () => fired.push("palette.close"),
      },
    ]);
    return null;
  }

  test("registers the shell's keys, passes them under a drawer, and yields to the palette", () => {
    const fired: string[] = [];
    const shell = mount(<Shell fired={fired} />);
    const tap = (key: string, init: KeyboardEventInit = {}) => press(appKeymap, key, init);
    tap("c");
    let sheet: ReturnType<typeof openAppLayer> | undefined;
    settle(() => {
      sheet = openAppLayer("passthrough");
    });
    tap("?", { shiftKey: true });
    const palette = mount(<UpstreamPalette fired={fired} />);
    tap("k", { ctrlKey: true });
    tap("c");
    palette.unmount();
    settle(() => sheet?.close());
    shell.unmount();
    tap("c");
    expect(fired).toEqual(["global.create", "global.help", "palette.close"]);
  });
  test("stops the global keys while a Base UI dialog is open with the focus inside, and ? still runs", async () => {
    const fired: string[] = [];
    const page = (open: boolean) => (
      <>
        <Shell fired={fired} />
        <Dialog open={open}>
          <DialogContent>
            <DialogTitle>Rename</DialogTitle>
            <button type="button">Save</button>
          </DialogContent>
        </Dialog>
      </>
    );
    const view = mount(page(true));
    const save = () =>
      document.body.querySelector<HTMLElement>('[data-slot="dialog-content"] button');
    await until(() => save() !== null);
    settle(() => save()?.focus());
    expect(save()?.closest('[data-slot="dialog-content"]')?.contains(document.activeElement)).toBe(
      true
    );
    const tap = (key: string, init: KeyboardEventInit = {}) => press(appKeymap, key, init);
    tap("c");
    tap("g");
    tap("i");
    tap("?", { shiftKey: true });
    expect(fired).toEqual(["global.help"]);
    // Control: once the dialog has closed, the same key runs.
    view.rerender(page(false));
    await until(() => save() === null);
    tap("c");
    expect(fired).toEqual(["global.help", "global.create"]);
  });

  test("? does not run with the focus in a select that is open over an alert dialog", async () => {
    const fired: string[] = [];
    const items = [
      { value: "open", label: "Open" },
      { value: "done", label: "Done" },
    ];
    const view = mount(
      <>
        <Shell fired={fired} />
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogTitle>Delete the issue?</AlertDialogTitle>
            <Select defaultValue="open" items={items} open>
              <SelectTrigger aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
    const popup = (slot: string) =>
      document.body.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
    const option = () => popup("select-content")?.querySelector<HTMLElement>('[role="option"]');
    // A popup with no option yet answers null, not undefined.
    await until(() => option() != null);
    settle(() => option()?.focus());
    // The select's popup is in a portal: the focus is in it, and outside the alert dialog's.
    expect(popup("select-content")?.contains(document.activeElement)).toBe(true);
    expect(popup("alert-dialog-content")?.contains(document.activeElement)).toBe(false);
    press(appKeymap, "?", { shiftKey: true });
    expect(fired).toEqual([]);
    // Closed in the row: an open select positions itself again after the row ends, outside act.
    view.unmount();
  });

  test("a new label reaches the engine's list, which copies a label when it registers", () => {
    const labelled = (label: string) => {
      return specsFor(appCatalog, "global", (command) => ({
        run: () => {},
        label: command.name === "create" ? label : undefined,
      }));
    };
    function Labelled({ label }: { label: string }) {
      useRegisterCommands(appCatalog, "global", labelled(label));
      return null;
    }
    const createLabel = () =>
      appKeymap.describe().find((binding) => binding.id === "global.create")?.label;
    const view = mount(<Labelled label="Create issue" />);
    expect(createLabel()).toBe("Create issue");
    view.rerender(<Labelled label="Create a sub-issue" />);
    expect(createLabel()).toBe("Create a sub-issue");
  });

  test("registers the under-overlay copies only while they can fire, so no chord waits under upstream's dialogs", () => {
    mount(<Shell fired={[]} />);
    const copies = () =>
      appKeymap
        .describe()
        .filter((binding) => binding.id.endsWith(UNDER_OVERLAY))
        .map((binding) => binding.id);
    expect(copies()).toEqual([]);
    let close = () => {};
    settle(() => {
      close = appKeymap.pushScope(DIALOG_SCOPE);
    });
    expect(copies()).toEqual([]);
    settle(() => close());
    // Control: under a drawer of ours the copies are there.
    let drawer: ReturnType<typeof openAppLayer> | undefined;
    settle(() => {
      drawer = openAppLayer("passthrough");
    });
    expect(copies()).toContain(`global.go-inbox${UNDER_OVERLAY}`);
    settle(() => drawer?.close());
  });

  test("the command store takes each commit's gate, label and run", () => {
    const fired: string[] = [];
    const specs = (enabled: boolean, label: string, tag: string) => {
      return specsFor(appCatalog, "global", (command) =>
        command.name === "create"
          ? { enabled, label, run: () => fired.push(tag) }
          : { run: () => {} }
      );
    };
    function Live(props: { enabled: boolean; label: string; tag: string }) {
      useRegisterCommands(appCatalog, "global", specs(props.enabled, props.label, props.tag));
      return null;
    }
    const view = mount(<Live enabled={false} label="Create issue" tag="first" />);
    expect(commandStore.view("global.create")?.enabled).toBe(false);
    view.rerender(<Live enabled label="Create a sub-issue" tag="second" />);
    expect(commandStore.view("global.create")).toMatchObject({
      enabled: true,
      label: "Create a sub-issue",
    });
    commandStore.run("global.create");
    expect(fired).toEqual(["second"]);
  });
});
