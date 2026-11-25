import { afterEach, describe, expect, test } from "bun:test";
import { Dialog, DialogContent, DialogTitle } from "@legion/ui/components/dialog";
import { Sheet, SheetContent, SheetTitle } from "@legion/ui/components/sheet";
import { act } from "react";

import { render, settle } from "../../tests/react";
import { focusedOverlays, GLOBAL_KEYS_ATTRIBUTE } from "./focused-overlay";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

const popup = (slot: string) => document.body.querySelector<HTMLElement>(`[data-slot="${slot}"]`);

async function until(done: () => boolean): Promise<void> {
  for (let tries = 0; tries < 40 && !done(); tries += 1) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
}

describe("the overlays over the page", () => {
  test("are none on a page with no overlay", () => {
    expect(focusedOverlays.get()).toEqual([]);
  });

  test("stack as the page stacks them, not as the focus sits: a dialog over a sheet is on top while the focus is still in the sheet", async () => {
    mounted.push(
      render(
        <Sheet open>
          <SheetContent {...{ [GLOBAL_KEYS_ATTRIBUTE]: "" }} initialFocus={false}>
            <SheetTitle>Details</SheetTitle>
            <button type="button">In the sheet</button>
            <Dialog open>
              <DialogContent initialFocus={false}>
                <DialogTitle>Rename</DialogTitle>
              </DialogContent>
            </Dialog>
          </SheetContent>
        </Sheet>
      )
    );
    await until(() => popup("dialog-content") !== null);
    const sheet = popup("sheet-content");
    const dialog = popup("dialog-content");
    if (sheet === null || dialog === null) throw new Error("the overlays did not open");
    settle(() => sheet.querySelector("button")?.focus());
    expect(sheet.contains(document.activeElement)).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(false);
    // The sheet passes the global keys and the dialog does not, so their kinds tell them apart.
    expect(focusedOverlays.get().map((layer) => layer.kind)).toEqual(["passthrough", "overlay"]);
  });
});
