import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { answerRequests } from "@upstream-dispatch/__tests__/network";
import { http } from "msw";

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

/** Mounts the hook with Dispatch answering each sign-out with `logout`; `asked` counts them. */
function mount(logout: () => Response) {
  const sent = { asked: 0 };
  answerRequests(
    http.post("/auth/logout", () => {
      sent.asked += 1;
      return logout();
    })
  );
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
  cleanups.push(() => view.unmount());
  return { client, sent, signOut: () => current };
}

describe("useSignOut", () => {
  test("a refused sign-out says so and keeps this tab's reads", async () => {
    const { client, signOut } = mount(() => Response.json({}, { status: 403 }));
    client.setQueryData(["inbox"], "kept");
    settle(() => signOut()?.start());
    expect(signOut()?.pending).toBe(true);
    await waitFor(() => expect(signOut()?.error).toContain("did not go through"));
    expect(signOut()?.pending).toBe(false);
    expect(client.getQueryData<string>(["inbox"])).toBe("kept");
  });

  test("a sign-out that goes through drops every read but who is here", async () => {
    const { client, sent, signOut } = mount(() => Response.json({ ok: true }));
    client.setQueryData(["inbox"], "dropped");
    settle(() => signOut()?.start());
    await waitFor(() => expect(client.getQueryData(["inbox"])).toBeUndefined());
    expect(sent.asked).toBe(1);
    expect(signOut()?.error).toBeUndefined();
  });
});
