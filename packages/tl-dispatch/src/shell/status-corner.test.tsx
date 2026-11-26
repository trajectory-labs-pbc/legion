import { afterEach, describe, expect, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { createDraftStore, DRAFT_KEPT_UNITS } from "@upstream-dispatch/features/inbox/draft-store";

import { render, settle } from "../../tests/react";
import { pressWrite, signedInClient } from "../../tests/writes";
import { StatusCorner } from "./status-corner";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

function mount(client = signedInClient()) {
  const view = render(
    <QueryClientProvider client={client}>
      <StatusCorner />
    </QueryClientProvider>
  );
  mounted.push(view);
  return view;
}

describe("StatusCorner", () => {
  test("says nothing while no write is out and the live feed has not stopped, and holds its live region", () => {
    const view = mount();
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
    const view = mount(client);
    await pressWrite(client);
    const pending = view.container.querySelector('[data-testid="pending-writes"]');
    expect(pending?.textContent).toBe("Saving 1 change…");
  });

  test("SHL-16 says a draft is lost on a reload when the tab does not keep it", () => {
    const drafts = createDraftStore("reply");
    drafts.signedIn("reader");
    const view = mount();
    settle(() => drafts.set("ask-1", "x".repeat(DRAFT_KEPT_UNITS + 1)));
    expect(view.container.querySelector('[data-testid="drafts-not-kept"]')?.textContent).toContain(
      "longer than"
    );
  });
});
