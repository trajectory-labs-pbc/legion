import { describe, expect, test } from "bun:test";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createDraftStore, DRAFT_KEPT_UNITS } from "@upstream-dispatch/features/inbox/draft-store";

import { mount } from "../../tests/mount";
import { settle } from "../../tests/react";
import { pressWrite, signedInClient } from "../../tests/writes";
import { StatusCorner } from "./status-corner";
import type { SignOut } from "./use-sign-out";

const clearError = () => {};

function corner({
  client = signedInClient(),
  signOut,
}: {
  client?: QueryClient;
  signOut?: Pick<SignOut, "start" | "pending" | "error" | "clearError">;
} = {}) {
  return mount(
    <QueryClientProvider client={client}>
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
  });

  test("SHL-15 says a change is still being saved", async () => {
    const client = signedInClient();
    const view = corner({ client });
    await pressWrite(client);
    const pending = view.container.querySelector('[data-testid="pending-writes"]');
    expect(pending?.textContent).toBe("Saving 1 change…");
  });

  test("SHL-16 says a draft is lost on a reload when the tab does not keep it", () => {
    const drafts = createDraftStore("reply");
    drafts.signedIn("reader");
    const view = corner();
    settle(() => drafts.set("ask-1", "x".repeat(DRAFT_KEPT_UNITS + 1)));
    expect(view.container.querySelector('[data-testid="drafts-not-kept"]')?.textContent).toContain(
      "longer than"
    );
  });

  test("shows a refused sign-out with a Retry that signs out again, busy while one is out", () => {
    let started = 0;
    const error = "The sign-out did not go through.";
    const retry = (view: { container: HTMLElement }) =>
      view.container.querySelector<HTMLButtonElement>('[role="alert"] button');
    const idle = corner({
      signOut: { clearError, error, pending: false, start: () => (started += 1) },
    });
    expect(idle.container.querySelector('[role="alert"]')?.textContent).toContain(
      "did not go through"
    );
    settle(() => retry(idle)?.click());
    expect(started).toBe(1);
    idle.unmount();

    const busy = corner({
      signOut: { clearError, error, pending: true, start: () => (started += 1) },
    });
    expect(retry(busy)?.getAttribute("aria-busy")).toBe("true");
    settle(() => retry(busy)?.click());
    expect(started).toBe(1);
    busy.unmount();
  });

  test("a refused sign-out's Dismiss puts it away, and keeps the session", () => {
    let cleared = 0;
    let started = 0;
    const view = corner({
      signOut: {
        clearError: () => (cleared += 1),
        error: "The sign-out did not go through.",
        pending: false,
        start: () => (started += 1),
      },
    });
    const dismiss = [
      ...view.container.querySelectorAll<HTMLButtonElement>('[role="alert"] button'),
    ].find((button) => button.textContent === "Dismiss");
    settle(() => dismiss?.click());
    expect([cleared, started]).toEqual([1, 0]);
    view.unmount();
  });

  test("says a sign-out is under way, where it stays in view after a drawer closes", () => {
    const signingOut = (pending: boolean, error?: string) => {
      const view = corner({ signOut: { clearError, error, pending, start: () => {} } });
      const line = view.container.querySelector('[role="status"]')?.textContent;
      view.unmount();
      return line;
    };
    expect(signingOut(true)).toBe("Signing out…");
    // Idle, or refused with Retry busy in its alert, the line is not drawn.
    expect(signingOut(false)).toBe("");
    expect(signingOut(true, "The sign-out did not go through.")).toBe("");
  });

  test("control: with no refusal it shows no alert", () => {
    const view = corner({
      signOut: { clearError, error: undefined, pending: false, start: () => {} },
    });
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    view.unmount();
  });
});
