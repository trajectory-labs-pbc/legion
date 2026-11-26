import { afterEach, describe, expect, jest, spyOn, test } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { onFakeClock } from "@upstream-dispatch/__tests__/fake-clock";
import { installFakeLiveSockets } from "@upstream-dispatch/__tests__/live-socket-harness";
import { liveSocketFor } from "@upstream-dispatch/api/live-socket";
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

  test("SHL-33 the connection pill says the live feed is reconnecting, and offers a reload once it is stuck", async () => {
    const sockets = installFakeLiveSockets();
    mounted.push({ unmount: () => sockets.restore() });
    const reload = spyOn(window.location, "reload").mockImplementation(() => undefined);
    mounted.push({ unmount: () => reload.mockRestore() });
    const client = signedInClient();
    const view = mount(client);
    // The page's event feed opens the socket; both go once the corner is gone.
    const live = liveSocketFor(client);
    const stopFeed = live.subscribeEvents({
      since: () => null,
      onStart: () => {},
      onEvent: () => {},
    });
    mounted.push({
      unmount: () => {
        stopFeed();
        live.close();
      },
    });
    const pill = () => view.container.querySelector('[data-testid="connection-pill"]');
    await onFakeClock(async () => {
      settle(() => sockets.latest().open());
      expect(pill()).toBeNull();
      settle(() => sockets.latest().drop());
      expect(pill()?.textContent).toBe("Reconnecting…");
      // Every reconnect fails, as it starts, for two minutes.
      settle(() => {
        for (let waited = 0; waited < 120_000; waited += 500) {
          jest.advanceTimersByTime(500);
          const socket = sockets.latest();
          if (socket.readyState === 0) socket.drop();
        }
      });
      expect(pill()?.textContent).toContain("Live updates are not reaching this page");
      settle(() => pill()?.querySelector("button")?.click());
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });
});
