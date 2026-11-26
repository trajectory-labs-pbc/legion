import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { whoAmIQuery } from "@upstream-dispatch/api/queries";
import { DEFAULT_MARGIN_WIDTH } from "@upstream-dispatch/features/margin/margin-width";

import { render, settle } from "../../tests/react";
import { type ShellPreferences, useShellPreferences } from "./use-shell-preferences";

let preferences: ShellPreferences | undefined;
function Probe() {
  preferences = useShellPreferences();
  return null;
}

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
  window.localStorage.clear();
});

/** Mounts the hook for a reader Dispatch already named, so no read goes out. */
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(whoAmIQuery().queryKey, { kind: "user", login: "reader", event_head: "0" });
  mounted.push(
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    )
  );
}

/** The reader's storage key of a preference. */
const keyOf = (name: string) => `dispatch.${name}:reader`;
const stored = (name: string) => window.localStorage.getItem(keyOf(name));

describe("useShellPreferences", () => {
  test("SHL-34 reads and keeps shell.sidebar for the reader", () => {
    window.localStorage.setItem(keyOf("shell.sidebar"), "hidden");
    mount();
    expect(preferences?.sidebarHidden).toBe(true);
    settle(() => preferences?.setSidebarHidden(false));
    expect(preferences?.sidebarHidden).toBe(false);
    expect(stored("shell.sidebar")).toBe("shown");
  });

  test("SHL-35 reads and keeps shell.margin for the reader", () => {
    mount();
    expect(preferences?.marginHidden).toBe(false);
    settle(() => preferences?.setMarginHidden(true));
    expect(preferences?.marginHidden).toBe(true);
    expect(stored("shell.margin")).toBe("hidden");
  });

  test("SHL-36 reads and keeps shell.margin-width, and a width that is no number is the default", () => {
    window.localStorage.setItem(keyOf("shell.margin-width"), "wide");
    mount();
    expect(preferences?.marginWidth).toBe(DEFAULT_MARGIN_WIDTH);
    settle(() => preferences?.setMarginWidth(420));
    expect(preferences?.marginWidth).toBe(420);
    expect(stored("shell.margin-width")).toBe("420");
  });
});
