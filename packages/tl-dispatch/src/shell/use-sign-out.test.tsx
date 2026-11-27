import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { answerRequests } from "@upstream-dispatch/__tests__/network";
import { SendStoppedError } from "@upstream-dispatch/features/writes/keyed-write";
import { http } from "msw";

import { render, settle } from "../../tests/react";
import { pressWrite } from "../../tests/writes";
import { SignOutQuestion } from "./sign-out-question";
import { type SignOut, unsentLabels, useSignOut } from "./use-sign-out";

describe("unsentLabels", () => {
  test("SHL-26 lists each change once, this tab's label first", () => {
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
    const signOut = useSignOut("reader");
    current = signOut;
    return (
      <SignOutQuestion
        onConfirm={signOut.confirm}
        onDismiss={signOut.dismiss}
        open={signOut.asking}
        question={signOut.question}
      />
    );
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
    // Put away, the refusal goes and the session stays.
    settle(() => signOut()?.clearError());
    expect(signOut()?.error).toBeUndefined();
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

  test("SHL-26 asks first while a change is unsent: Cancel keeps the session, Sign out ends it", async () => {
    const { client, sent, signOut } = mount(() => Response.json({ ok: true }));
    // The sign-out stops the unsent write, so its press ends with the stop.
    const { outcome: stopped } = await pressWrite(client, { label: "CORE-1 set to done" });
    const question = () => document.body.querySelector<HTMLElement>('[role="alertdialog"]');
    const answer = (name: string) =>
      [...(question()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === name);

    settle(() => signOut()?.start());
    await waitFor(() => expect(answer("Cancel")).toHaveFocus());
    expect(question()).toHaveAccessibleName("Sign out?");
    expect(question()).toHaveAccessibleDescription(
      "Sign out and discard 1 unsent change? • CORE-1 set to done"
    );
    settle(() => answer("Cancel")?.click());
    await waitFor(() => expect(signOut()?.asking).toBe(false));
    expect(sent.asked).toBe(0);

    settle(() => signOut()?.start());
    await waitFor(() => expect(signOut()?.asking).toBe(true));
    settle(() => answer("Sign out")?.click());
    await waitFor(() => expect(sent.asked).toBe(1));
    expect(await stopped).toBeInstanceOf(SendStoppedError);
  });
});
