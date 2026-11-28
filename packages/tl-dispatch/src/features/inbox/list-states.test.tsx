import { describe, expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Read } from "@/data/read";
import { mount } from "../../../tests/mount";
import { onFakeClock, tick } from "../../../tests/upstream";
import { InboxListBoundary } from "./list-states";

const READY: Read<unknown> = { state: "ready", data: [], refreshError: undefined };

/** The boundary for `read`, with its rows and, when given, its empty list. */
const draw = (read: Read<unknown>, empty?: string) =>
  mount(
    <InboxListBoundary empty={empty === undefined ? undefined : <p>{empty}</p>} read={read}>
      <p>rows</p>
    </InboxListBoundary>
  );

describe("the Inbox list's states", () => {
  test("INB-28 a list that loads draws nothing for 200 ms, then still rows labelled Loading your inbox", async () => {
    await onFakeClock(async () => {
      const view = draw({ state: "loading" });
      await tick(150);
      expect(screen.queryByRole("status")).toBeNull();
      await tick(100);
      const status = screen.getByRole("status", { name: "Loading your inbox" });
      expect(status.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(12);
      expect(screen.queryByText("rows")).toBeNull();
      view.unmount();
    });
  });

  test("INB-29 a failed read says Could not load your inbox., and its Retry reads again", async () => {
    const retry = mock(() => {});
    draw({ state: "error", error: new Error("down"), retrying: false, retry });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Could not load your inbox.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("rows")).toBeNull();
  });

  test("INB-29 a read Dispatch refused offers no Retry", () => {
    draw({ state: "error", error: new Error("no"), retrying: false, refusal: "forbidden" });
    expect(screen.getByRole("alert").textContent).toContain("Could not load your inbox.");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test("a ready list draws its empty list when one is given, else its rows", () => {
    const empty = draw(READY, "Nothing needs you");
    expect(screen.getByText("Nothing needs you")).toBeDefined();
    expect(screen.queryByText("rows")).toBeNull();
    empty.unmount();
    draw(READY);
    expect(screen.getByText("rows")).toBeDefined();
  });
});
