import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SignInChannel } from "@upstream-dispatch/features/shell/sign-in-channel";

import { render } from "../../tests/react";
import { useSignInChannel } from "./use-sign-in-channel";

type Handlers = Parameters<SignInChannel["listen"]>[0];

function Probe({ channel }: { channel: Pick<SignInChannel, "listen"> }) {
  useSignInChannel(channel);
  return null;
}

describe("useSignInChannel", () => {
  test("listens while mounted and answers another tab with this tab's unsent writes", () => {
    let heard: Handlers | undefined;
    let stopped = 0;
    const channel = {
      listen: (handlers: Handlers) => {
        heard = handlers;
        return () => {
          stopped += 1;
        };
      },
    };
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe channel={channel} />
      </QueryClientProvider>
    );
    expect(heard?.unsent("reader")).toEqual([]);
    expect(stopped).toBe(0);
    view.unmount();
    expect(stopped).toBe(1);
  });

  test("a tab gone mid sign-out sends Dispatch a whoami, to settle the writes it held", async () => {
    let heard: Handlers | undefined;
    const channel = {
      listen: (handlers: Handlers) => {
        heard = handlers;
        return () => {};
      },
    };
    const asked: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      (input: RequestInfo | URL) => {
        asked.push(String(input));
        return new Promise<Response>(() => {});
      },
      { preconnect: realFetch.preconnect }
    );
    try {
      const view = render(
        <QueryClientProvider client={new QueryClient()}>
          <Probe channel={channel} />
        </QueryClientProvider>
      );
      heard?.holderGone("reader");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(asked.some((url) => url.endsWith("/auth/whoami"))).toBe(true);
      view.unmount();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
