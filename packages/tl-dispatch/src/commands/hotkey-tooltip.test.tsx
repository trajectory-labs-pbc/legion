import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { act, createRef } from "react";

import { render, settle } from "../../tests/react";
import { specsFor } from "../../tests/specs";
import { appCatalog } from "./app-catalog";
import type { HotkeyTooltip as HotkeyTooltipType } from "./hotkey-tooltip";
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
  loadHotkeyTooltip(load?: () => Promise<never>): Promise<void>;
}

/** The module as a first page load runs it: the tooltip's code not yet arrived. */
async function freshModule(): Promise<TooltipModule> {
  const specifier = `./hotkey-tooltip?arrival=${Date.now()}-${Math.random()}`;
  return await import(specifier);
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

describe("HotkeyTooltip, while its code arrives", () => {
  test("a control focused before the code arrives keeps the focus after", async () => {
    const { HotkeyTooltip, loadHotkeyTooltip } = await freshModule();
    const view = render(
      <>
        <Shell />
        <HotkeyTooltip commandId="global.search">
          <button type="button">Search</button>
        </HotkeyTooltip>
      </>
    );
    mounted.push(view);
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
    const view = render(
      <>
        <Shell />
        <input aria-label="Elsewhere" />
        <HotkeyTooltip commandId="global.search">
          <button type="button">Search</button>
        </HotkeyTooltip>
      </>
    );
    mounted.push(view);
    const elsewhere = view.container.querySelector("input");
    settle(() => elsewhere?.focus());
    await act(() => loadHotkeyTooltip());
    expect(document.activeElement).toBe(elsewhere);
  });

  test("the control's own ref follows it across the arrival", async () => {
    const { HotkeyTooltip, loadHotkeyTooltip } = await freshModule();
    const own = createRef<HTMLButtonElement>();
    const view = render(
      <>
        <Shell />
        <HotkeyTooltip commandId="global.search">
          <button ref={own} type="button">
            Search
          </button>
        </HotkeyTooltip>
      </>
    );
    mounted.push(view);
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
    const view = render(
      <>
        <Shell />
        <HotkeyTooltip commandId="global.search">
          <button type="button">Search</button>
        </HotkeyTooltip>
      </>
    );
    mounted.push(view);
    await act(() => arrival);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    const control = view.container.querySelector("button");
    expect(control?.getAttribute("data-slot")).toBeNull();
    expect(control?.getAttribute("aria-keyshortcuts")).toMatch(/^(Meta|Control)\+K \/$/);
  });
});
