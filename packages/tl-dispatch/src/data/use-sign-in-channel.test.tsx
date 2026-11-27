import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { http } from "msw";
import type { SignInChannel } from "@/upstream/data-hooks";
import { render } from "../../tests/react";
import { answerRequests } from "../../tests/upstream";
import { useSignInChannel } from "./use-sign-in-channel";

type Handlers = Parameters<SignInChannel["listen"]>[0];

function Probe({ channel }: { channel: Pick<SignInChannel, "listen"> }) {
  useSignInChannel(channel);
  return null;
}

describe("useSignInChannel", () => {
  test("SHL-21 listens while mounted and answers another tab with this tab's unsent writes", () => {
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

  test("SHL-21 a tab gone mid sign-out sends Dispatch a whoami, to settle the writes it held", async () => {
    let heard: Handlers | undefined;
    const channel = {
      listen: (handlers: Handlers) => {
        heard = handlers;
        return () => {};
      },
    };
    // The sign-in check is asked and never answers.
    let asked = 0;
    answerRequests(
      http.get("/auth/whoami", () => {
        asked += 1;
        return new Promise<Response>(() => {});
      })
    );
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe channel={channel} />
      </QueryClientProvider>
    );
    heard?.holderGone("reader");
    await waitFor(() => expect(asked).toBeGreaterThan(0));
    view.unmount();
  });
});
