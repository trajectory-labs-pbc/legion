import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { render, settle } from "../../tests/react";
import { StatusCorner } from "./status-corner";
import type { SignOut } from "./use-sign-out";

function corner(signOut?: Pick<SignOut, "start" | "pending" | "error">) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <StatusCorner signOut={signOut} />
    </QueryClientProvider>
  );
}

describe("StatusCorner", () => {
  test("says nothing while no write is out and the live feed has not stopped, and holds its live region", () => {
    const view = corner();
    expect(view.container.querySelector('[data-testid="connection-pill"]')).toBeNull();
    expect(view.container.textContent).toBe("");
    // The live region is there before its line, so the line is announced when it appears.
    const region = view.container.querySelector('[role="status"]');
    expect(region?.childElementCount).toBe(0);
    // A hidden region is out of the accessibility tree, and its first line goes unannounced.
    expect(region?.className).not.toContain("hidden");
    view.unmount();
  });

  test("shows a refused sign-out with a Retry that signs out again, busy while one is out", () => {
    let started = 0;
    const error = "The sign-out did not go through.";
    const retry = (view: { container: HTMLElement }) =>
      view.container.querySelector<HTMLButtonElement>('[role="alert"] button');
    const idle = corner({ error, pending: false, start: () => (started += 1) });
    expect(idle.container.querySelector('[role="alert"]')?.textContent).toContain(
      "did not go through"
    );
    settle(() => retry(idle)?.click());
    expect(started).toBe(1);
    idle.unmount();

    const busy = corner({ error, pending: true, start: () => (started += 1) });
    expect(retry(busy)?.getAttribute("aria-busy")).toBe("true");
    settle(() => retry(busy)?.click());
    expect(started).toBe(1);
    busy.unmount();
  });

  test("control: with no refusal it shows no alert", () => {
    const view = corner({ error: undefined, pending: false, start: () => {} });
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    view.unmount();
  });
});
