import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useContext } from "react";
import { TextAskBlockCard, TextAskCard, useRegistryPolling } from "@/upstream/shell";

import { GlobalCommands } from "../../tests/global-shell";
import { answerShellReads, json, waitFor } from "../../tests/network";
import { render, settle } from "../../tests/react";
import { SignedInParts } from "./signed-in-parts";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

/** Draws `children` as the shell does for a signed-in person. */
function mount(children: ReactNode) {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <SignedInParts>{children}</SignedInParts>
    </QueryClientProvider>
  );
  mounted.push(view);
}

describe("SignedInParts", () => {
  test("SHL-2 a key pressed anywhere on the page runs its command", () => {
    const fired: string[] = [];
    mount(<GlobalCommands fired={fired} />);
    settle(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true })
      );
    });
    expect(fired).toEqual(["global.help"]);
  });

  test("SHL-8 a post's renderer finds the ask card that draws an ask block", () => {
    const seen: { card?: unknown } = {};
    // What `useRenderedMarkdown` reads to draw an ask block of a post.
    function Post() {
      seen.card = useContext(TextAskCard);
      return null;
    }
    mount(<Post />);
    expect(seen.card).toBe(TextAskBlockCard);
  });

  test("SHL-9 a part that shows agents has the registry read", async () => {
    const { asked } = answerShellReads((url) =>
      url.endsWith("/api/v1/agents") ? json([]) : undefined
    );
    function RegistryReader() {
      useRegistryPolling(true);
      return null;
    }
    mount(<RegistryReader />);
    await waitFor(() => asked.length === 1);
    expect(asked[0]).toEndWith("/api/v1/agents");
  });
});
