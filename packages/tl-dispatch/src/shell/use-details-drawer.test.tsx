import { afterEach, describe, expect, test } from "bun:test";
import type { MarginDrawer } from "@upstream-dispatch/features/issue-page/margin-slot";

import { render, settle } from "../../tests/react";
import { useDetailsDrawer } from "./use-details-drawer";

let drawer: MarginDrawer | undefined;
function Probe({ frame, issue }: { frame: boolean; issue: string | undefined }) {
  drawer = useDetailsDrawer(frame, issue);
  return null;
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

describe("useDetailsDrawer", () => {
  test("SHL-29 opens for the issue on screen, and another issue closes it", () => {
    const view = render(<Probe frame issue="AB-1" />);
    mounted.push(view);
    expect(drawer?.open).toBe(false);
    settle(() => drawer?.setOpen(true));
    expect(drawer?.open).toBe(true);
    view.rerender(<Probe frame issue="AB-2" />);
    expect(drawer?.open).toBe(false);
    view.rerender(<Probe frame issue="AB-1" />);
    expect(drawer?.open).toBe(false);
  });

  test("SHL-29 control: outside the issue frame there is no drawer", () => {
    mounted.push(render(<Probe frame={false} issue="AB-1" />));
    expect(drawer).toBeUndefined();
  });
});
