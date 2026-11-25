import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { appKeymap, DIALOG_SCOPE } from "@upstream-dispatch/features/shell/keymap";

import { act } from "react";

import { render, settle } from "../../tests/react";
import { specsFor } from "../../tests/specs";
import { appCatalog } from "./app-catalog";
import { CommandButton, commandButtonVariant } from "./command-button";
import { HotkeyTooltip, loadHotkeyTooltip } from "./hotkey-tooltip";
import { useCommandShortcut } from "./use-command";
import { useRegisterCommands } from "./use-register-commands";

const globalSpecs = (fired: string[], enabled: boolean) =>
  specsFor(appCatalog, "global", (command) => ({ enabled, run: () => fired.push(command.id) }));

function Shell({ fired, enabled = true }: { fired: string[]; enabled?: boolean }) {
  useRegisterCommands(appCatalog, "global", globalSpecs(fired, enabled));
  return null;
}

// The tooltip's code is its own chunk; the shell loads it after the first paint.
beforeAll(() => loadHotkeyTooltip());

const mounted: { unmount(): void }[] = [];
function mount(element: Parameters<typeof render>[0]) {
  const view = render(element);
  mounted.push(view);
  return view;
}
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

const press = (key: string) =>
  appKeymap.handleKeyDown(new KeyboardEvent("keydown", { key, cancelable: true }));

const button = (container: HTMLElement) => container.querySelector("button");

describe("CommandButton", () => {
  test("a click runs exactly what the key runs", () => {
    const fired: string[] = [];
    const { container } = mount(
      <>
        <Shell fired={fired} />
        <CommandButton commandId="global.create" />
      </>
    );
    settle(() => button(container)?.click());
    press("c");
    expect(fired).toEqual(["global.create", "global.create"]);
  });

  test("draws the catalog's label and icon, and names an icon-only button", () => {
    const { container } = mount(
      <>
        <Shell fired={[]} />
        <CommandButton commandId="global.create" />
        <CommandButton commandId="global.search" size="icon" />
      </>
    );
    const [create, search] = container.querySelectorAll("button");
    expect(create?.textContent).toBe("Create issue");
    expect(create?.querySelector("svg")).not.toBeNull();
    expect(create?.dataset.variant).toBe("default");
    expect(search?.textContent).toBe("");
    expect(search?.getAttribute("aria-label")).toBe("Command menu");
    expect(search?.dataset.variant).toBe("ghost");
  });

  test("a label replaces the catalog's and keeps the command's run", () => {
    const fired: string[] = [];
    const { container } = mount(
      <>
        <Shell fired={fired} />
        <CommandButton commandId="global.create" label="New issue" />
      </>
    );
    expect(button(container)?.textContent).toBe("New issue");
    settle(() => button(container)?.click());
    expect(fired).toEqual(["global.create"]);
  });

  test("a disabled command hides its button, unless asked to show it, and then never runs", () => {
    const fired: string[] = [];
    const hidden = mount(
      <>
        <Shell enabled={false} fired={fired} />
        <CommandButton commandId="global.create" />
      </>
    );
    expect(button(hidden.container)).toBeNull();
    hidden.unmount();
    mounted.length = 0;
    const shown = mount(
      <>
        <Shell enabled={false} fired={fired} />
        <CommandButton commandId="global.create" showIfDisabled />
      </>
    );
    expect(button(shown.container)?.disabled).toBe(true);
    settle(() => button(shown.container)?.click());
    press("c");
    expect(fired).toEqual([]);
  });

  test("draws nothing until its command mounts", () => {
    const { container } = mount(<CommandButton commandId="global.create" />);
    expect(button(container)).toBeNull();
  });

  test("a destructive command is destructive unless the caller picks a variant", () => {
    const view = (destructive: boolean) => ({
      command: { ...appCatalog.command("global.create"), destructive },
      label: "x",
      enabled: true,
    });
    expect(commandButtonVariant(view(true), false)).toBe("destructive");
    expect(commandButtonVariant(view(false), true)).toBe("ghost");
    expect(commandButtonVariant(view(false), false)).toBe("default");
  });
});

describe("HotkeyTooltip", () => {
  test("names the command's single-press keys for assistive tech, and none while it is off", () => {
    const on = mount(
      <>
        <Shell fired={[]} />
        <HotkeyTooltip commandId="global.search">
          <button type="button">Search</button>
        </HotkeyTooltip>
      </>
    );
    expect(button(on.container)?.getAttribute("aria-keyshortcuts")).toMatch(/^(Meta|Control)\+K$/);
    on.unmount();
    mounted.length = 0;
    const off = mount(
      <>
        <Shell enabled={false} fired={[]} />
        <HotkeyTooltip commandId="global.search">
          <button type="button">Search</button>
        </HotkeyTooltip>
      </>
    );
    expect(button(off.container)?.hasAttribute("aria-keyshortcuts")).toBe(false);
  });

  test("shows the label and the key's chips when the pointer rests on the control", async () => {
    const { container } = mount(
      <>
        <Shell fired={[]} />
        <CommandButton commandId="global.create" />
      </>
    );
    const trigger = button(container);
    if (trigger === null) throw new Error("no button");
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
    expect(popup?.textContent).toBe("Create issueC");
    expect([...(popup?.querySelectorAll("kbd") ?? [])].map((kbd) => kbd.textContent)).toEqual([
      "C",
    ]);
  });

  test("shows no key a dialog masks: under upstream's drawer, search has no chip and no aria key", () => {
    function Chips() {
      return <output>{useCommandShortcut("global.search")?.join(" ") ?? "none"}</output>;
    }
    const { container } = mount(
      <>
        <Shell fired={[]} />
        <CommandButton commandId="global.search" />
        <Chips />
      </>
    );
    const shown = () => [
      container.querySelector("output")?.textContent,
      button(container)?.hasAttribute("aria-keyshortcuts"),
    ];
    expect(shown()).toEqual([expect.stringMatching(/K$/), true]);
    let close = () => {};
    settle(() => {
      close = appKeymap.pushScope(DIALOG_SCOPE);
    });
    expect(shown()).toEqual(["none", false]);
    settle(() => close());
    expect(shown()).toEqual([expect.stringMatching(/K$/), true]);
  });
});
