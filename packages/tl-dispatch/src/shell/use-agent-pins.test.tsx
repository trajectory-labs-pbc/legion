import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { userAgentStateQuery } from "@upstream-dispatch/api/queries";
import { liveViewsOf } from "@upstream-dispatch/features/agent-view/live-views";
import { legacyPinnedAgentsKey } from "@upstream-dispatch/features/shell/userPreference";

import { holdReads } from "../../tests/network";
import { render, settle } from "../../tests/react";
import { type PinWrite, useLiveViewPins, usePinsMigration } from "./use-agent-pins";

function Probe({ login, write }: { login: string; write: PinWrite }) {
  usePinsMigration(login, write);
  return null;
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
  window.localStorage.clear();
});

const settleWrites = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("usePinsMigration", () => {
  test("writes each kept pin, in order, then forgets the browser's list", async () => {
    const key = legacyPinnedAgentsKey("reader");
    window.localStorage.setItem(key, JSON.stringify(["s1", "s2"]));
    const written: string[] = [];
    const write: PinWrite = async (sessionId) => {
      written.push(sessionId);
      return true;
    };
    mounted.push(render(<Probe login="reader" write={write} />));
    await settleWrites();
    expect(written).toEqual(["s1", "s2"]);
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  test("control: a refused write stops the move and keeps the list", async () => {
    const key = legacyPinnedAgentsKey("reader");
    window.localStorage.setItem(key, JSON.stringify(["s1", "s2"]));
    const written: string[] = [];
    const write: PinWrite = async (sessionId) => {
      written.push(sessionId);
      return false;
    };
    mounted.push(render(<Probe login="reader" write={write} />));
    await settleWrites();
    expect(written).toEqual(["s1"]);
    expect(window.localStorage.getItem(key)).not.toBeNull();
  });

  test("a new write function during the move starts no second move", async () => {
    window.localStorage.setItem(legacyPinnedAgentsKey("reader"), JSON.stringify(["s1", "s2"]));
    const written: string[] = [];
    const writer =
      (tag: string): PinWrite =>
      (sessionId) => {
        written.push(`${tag} ${sessionId}`);
        return new Promise<boolean>(() => {});
      };
    const view = render(<Probe login="reader" write={writer("a")} />);
    mounted.push(view);
    view.rerender(<Probe login="reader" write={writer("b")} />);
    await settleWrites();
    expect(written).toEqual(["a s1"]);
  });
});

describe("useLiveViewPins", () => {
  function Pins() {
    useLiveViewPins();
    return null;
  }

  test("SHL-13 a pinned agent's view is kept with nothing left in it, and an unpinned one's goes", () => {
    holdReads("/api/v1/me/agents/state");
    const client = new QueryClient();
    client.setQueryData(userAgentStateQuery().queryKey, {
      pinned: { pinned_at: "2026-11-01T00:00:00Z", unread_replies: 0 },
      unpinned: { unread_replies: 0 },
    });
    mounted.push(
      render(
        <QueryClientProvider client={client}>
          <Pins />
        </QueryClientProvider>
      )
    );
    const views = liveViewsOf(client);
    // A draft written and then emptied leaves a view that only a pin keeps.
    settle(() => {
      for (const sessionId of ["pinned", "unpinned"]) {
        views.setDraft(sessionId, "Hi");
        views.setDraft(sessionId, "");
      }
    });
    expect(Object.keys(window.__dispatchLiveViews?.views ?? {})).toEqual(["pinned"]);
  });
});
