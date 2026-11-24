import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";

import { json, stubFetch, waitFor } from "../../tests/fetch";
import { render, settle } from "../../tests/react";
import { type SignOut, unsentLabels, useSignOut } from "./use-sign-out";

describe("unsentLabels", () => {
  test("lists each change once, this tab's label first", () => {
    expect(
      unsentLabels(
        [
          { key: "a", label: "Reply to AB-1" },
          { key: "b", label: "Edit AB-2" },
        ],
        [
          { key: "a", label: "Reply to AB-1 (other tab)" },
          { key: "c", label: "Close AB-3" },
        ]
      )
    ).toEqual(["Reply to AB-1", "Edit AB-2", "Close AB-3"]);
    expect(unsentLabels([], [])).toEqual([]);
  });
});

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

const sleep = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

function mount(logout: Response) {
  const fetch = stubFetch((url) => (url.endsWith("/auth/logout") ? logout : undefined));
  const client = new QueryClient();
  let current: SignOut | undefined;
  function Probe() {
    current = useSignOut("reader");
    return null;
  }
  const view = render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );
  cleanups.push(fetch.restore, () => view.unmount());
  return { client, fetch, signOut: () => current };
}

describe("useSignOut", () => {
  test("a refused sign-out says so and keeps this tab's reads", async () => {
    const { client, signOut } = mount(json({}, 403));
    client.setQueryData(["inbox"], "kept");
    settle(() => signOut()?.start());
    expect(signOut()?.pending).toBe(true);
    await waitFor(() => signOut()?.error !== undefined, sleep);
    expect(signOut()?.error).toContain("did not go through");
    expect(signOut()?.pending).toBe(false);
    expect(client.getQueryData<string>(["inbox"])).toBe("kept");
  });

  test("a sign-out that goes through drops every read but who is here", async () => {
    const { client, fetch, signOut } = mount(json({ ok: true }));
    client.setQueryData(["inbox"], "dropped");
    settle(() => signOut()?.start());
    await waitFor(() => client.getQueryData(["inbox"]) === undefined, sleep);
    expect(fetch.asked.filter((url) => url.endsWith("/auth/logout"))).toHaveLength(1);
    expect(client.getQueryData(["inbox"])).toBeUndefined();
    expect(signOut()?.error).toBeUndefined();
  });
});
