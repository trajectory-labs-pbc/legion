import { describe, expect, jest, spyOn, test } from "bun:test";
import { realClock, tick } from "@upstream-dispatch/__tests__/fake-clock";
import { act, createRef } from "react";

import { mount } from "../../tests/mount";
import { settle } from "../../tests/react";
import { specsFor } from "../../tests/specs";
import { appCatalog } from "./app-catalog";
import type {
  HotkeyTooltip as HotkeyTooltipType,
  LabelTooltip as LabelTooltipType,
} from "./hotkey-tooltip";
import { useRegisterCommands } from "./use-register-commands";

function Shell() {
  useRegisterCommands(
    appCatalog,
    "global",
    specsFor(appCatalog, "global", () => ({ run: () => {} }))
  );
  return null;
}

interface TooltipModule {
  HotkeyTooltip: typeof HotkeyTooltipType;
  LabelTooltip: typeof LabelTooltipType;
  loadHotkeyTooltip(load?: () => Promise<never>): Promise<void>;
}

/** The module as a first page load runs it: the tooltip's code not yet arrived. */
async function freshModule(): Promise<TooltipModule> {
  const specifier = `./hotkey-tooltip?arrival=${Date.now()}-${Math.random()}`;
  return await import(specifier);
}

describe("HotkeyTooltip, while its code arrives", () => {
  test("a control focused before the code arrives keeps the focus after", async () => {
    const { HotkeyTooltip, loadHotkeyTooltip } = await freshModule();
    const view = mount(
      <>
        <Shell />
        <HotkeyTooltip commandId="global.search">
          <button type="button">Search</button>
        </HotkeyTooltip>
      </>
    );
    const before = view.container.querySelector("button");
    expect(before?.getAttribute("data-slot")).toBeNull();
    settle(() => before?.focus());
    expect(document.activeElement).toBe(before);
    await act(() => loadHotkeyTooltip());
    const after = view.container.querySelector("button");
    expect(after?.getAttribute("data-slot")).toBe("tooltip-trigger");
    expect(document.activeElement).toBe(after);
  });

  test("a control that was not focused does not take the focus when the code arrives", async () => {
    const { HotkeyTooltip, loadHotkeyTooltip } = await freshModule();
    const view = mount(
      <>
        <Shell />
        <input aria-label="Elsewhere" />
        <HotkeyTooltip commandId="global.search">
          <button type="button">Search</button>
        </HotkeyTooltip>
      </>
    );
    const elsewhere = view.container.querySelector("input");
    settle(() => elsewhere?.focus());
    await act(() => loadHotkeyTooltip());
    expect(document.activeElement).toBe(elsewhere);
  });

  test("the control's own ref follows it across the arrival", async () => {
    const { HotkeyTooltip, loadHotkeyTooltip } = await freshModule();
    const own = createRef<HTMLButtonElement>();
    const view = mount(
      <>
        <Shell />
        <HotkeyTooltip commandId="global.search">
          <button ref={own} type="button">
            Search
          </button>
        </HotkeyTooltip>
      </>
    );
    expect(own.current).toBe(view.container.querySelector("button"));
    await act(() => loadHotkeyTooltip());
    expect(own.current).toBe(view.container.querySelector("button"));
    expect(own.current?.getAttribute("data-slot")).toBe("tooltip-trigger");
  });

  test("a tooltip chunk that fails leaves the control working, with its keys", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    const { HotkeyTooltip, loadHotkeyTooltip } = await freshModule();
    // Asked before the first tooltip mounts, so the mount's request is this one.
    const arrival = loadHotkeyTooltip(() => Promise.reject(new Error("chunk gone")));
    const view = mount(
      <>
        <Shell />
        <HotkeyTooltip commandId="global.search">
          <button type="button">Search</button>
        </HotkeyTooltip>
      </>
    );
    await act(() => arrival);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    const control = view.container.querySelector("button");
    expect(control?.getAttribute("data-slot")).toBeNull();
    expect(control?.getAttribute("aria-keyshortcuts")).toMatch(/^(Meta|Control)\+K$/);
  });
});

describe("LabelTooltip", () => {
  test("shows its label and no key on hover, once the tooltip's code arrives", async () => {
    const { LabelTooltip, loadHotkeyTooltip } = await freshModule();
    const view = mount(
      <LabelTooltip label="Unpin Ada from the sidebar">
        <button aria-label="Unpin Ada from the sidebar" type="button" />
      </LabelTooltip>
    );
    await act(() => loadHotkeyTooltip());
    const control = view.container.querySelector("button");
    expect(control?.getAttribute("data-slot")).toBe("tooltip-trigger");
    expect(control?.hasAttribute("title")).toBe(false);
    jest.useFakeTimers();
    try {
      settle(() => {
        control?.dispatchEvent(
          new PointerEvent("pointerenter", { bubbles: true, pointerType: "mouse" })
        );
        control?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        control?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      });
      await tick(600);
      const popup = document.querySelector('[data-slot="tooltip-content"]');
      expect(popup?.textContent).toBe("Unpin Ada from the sidebar");
      expect(popup?.querySelector("kbd")).toBeNull();
    } finally {
      realClock();
    }
  });
});
