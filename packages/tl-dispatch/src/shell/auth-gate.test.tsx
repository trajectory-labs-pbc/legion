import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { http, type RequestHandler } from "msw";
import { sessionKey } from "@/data/session";
import type { DispatchEvent } from "@/upstream/contract";
import type { EventPages } from "@/upstream/live";
import { writesOf } from "@/upstream/writes";
import { renderApp } from "../../tests/app";
import { fakeLive } from "../../tests/live";
import { answerShellReads, holdReads, json } from "../../tests/network";
import { settle } from "../../tests/react";
import { shellChunksArrive } from "../../tests/shell-chunks";
import { answerDraft, answerRequests, setAnswerDraft } from "../../tests/upstream";
import { pressWrite, reader } from "../../tests/writes";
import { AuthGate } from "./auth-gate";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function mount(client = newClient()) {
  // An address whose page has no chunk, so none arrives while a test waits or after it.
  const view = renderApp(<AuthGate />, { path: "/no-such-page", client });
  cleanups.push(() => view.unmount());
  return view.container;
}

/** Mounts the gate for `reader`, whose shell's own reads stay pending, and waits for the shell. */
async function mountSignedIn(client = newClient(), ...handlers: RequestHandler[]) {
  answerShellReads((url) => (url.endsWith("/auth/whoami") ? json(reader) : undefined));
  if (handlers.length > 0) answerRequests(...handlers);
  const container = mount(client);
  await waitFor(() => expect(container.querySelector('[data-testid="app-shell"]')).not.toBeNull());
  await shellChunksArrive();
  return container;
}

describe("AuthGate", () => {
  test("SHL-25 draws the skeleton while Dispatch has not said who is here, in the shell's own panel", () => {
    holdReads("/auth/whoami");
    const container = mount();
    const skeleton = container.querySelector('[aria-busy="true"]');
    expect(skeleton?.querySelector('[data-testid="content-panel"] main')).not.toBeNull();
    // Nothing in it reads or goes anywhere before sign-in is known.
    expect(skeleton?.querySelector("a, button")).toBeNull();
    expect(skeleton?.textContent).toContain("Dispatch");
    // The navigation's rows are 28 px, in the skeleton's own colour.
    const rows = [
      ...(skeleton?.querySelectorAll('[aria-label="Loading navigation"] [data-slot="skeleton"]') ??
        []),
    ];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.className).toContain("h-control-sm");
      expect(row.className).not.toContain("bg-sidebar");
    }
  });

  test("SHL-23 a 401 draws the sign-in page", async () => {
    answerRequests(
      http.get("/auth/whoami", () =>
        Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
      )
    );
    const container = mount();
    await waitFor(() => expect(container.textContent).toContain("Sign in"));
  });

  test("SHL-22 a 401 drops every read made for the person who left, but who is here", async () => {
    answerRequests(
      http.get("/auth/whoami", () =>
        Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
      )
    );
    const client = newClient();
    client.setQueryData(["issues"], ["AB-1"]);
    const container = mount(client);
    await waitFor(() => expect(container.textContent).toContain("Sign in"));
    expect(client.getQueryData(["issues"])).toBeUndefined();
    expect(client.getQueryState(sessionKey)?.status).toBe("error");
  });

  test("SHL-24 a failed check announces that Dispatch is out of reach, and Retry asks again", async () => {
    let down = true;
    answerRequests(
      http.get("/auth/whoami", () =>
        down
          ? Response.json({ error: { code: "INTERNAL" } }, { status: 500 })
          : Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
      )
    );
    const container = mount();
    await waitFor(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        "Could not reach Dispatch."
      )
    );
    down = false;
    settle(() => container.querySelector("button")?.click());
    await waitFor(() => expect(container.textContent).toContain("Sign in"));
  });

  test("SHL-24 a check a proxy refused keeps a Retry that asks again, with the skeleton meanwhile", async () => {
    let asked = 0;
    let answer: (() => void) | undefined;
    // The shell's other reads stay pending; the check's own answer comes after, so it wins.
    answerShellReads(() => undefined);
    answerRequests(
      http.get("/auth/whoami", () => {
        asked += 1;
        if (asked === 1) return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
        return new Promise<Response>((resolve) => {
          answer = () => resolve(json(reader));
        });
      })
    );
    const container = mount();
    await waitFor(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        "Could not reach Dispatch."
      )
    );
    settle(() => container.querySelector("button")?.click());
    await waitFor(() => expect(asked).toBe(2));
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    await settle(async () => answer?.());
    await waitFor(() =>
      expect(container.querySelector('[data-testid="app-shell"]')).not.toBeNull()
    );
    await shellChunksArrive();
  });

  test("SHL-14 a write a reload cut off goes out again once the same person is signed in", async () => {
    // The page before the reload kept the write it was sending when it went.
    const before = newClient();
    writesOf(before).signedIn(reader.login);
    await pressWrite(before, {
      write: (bounds) => {
        bounds.sent?.({ body: { status: "done" }, method: "PATCH", path: "/api/v1/issues/AB-1" });
        return new Promise<never>(() => {});
      },
    });
    // The page after it.
    const sent: unknown[] = [];
    await mountSignedIn(
      newClient(),
      http.patch("/api/v1/issues/AB-1", async ({ request }) => {
        sent.push(await request.json());
        return Response.json({ key: "AB-1" });
      })
    );
    await waitFor(() => expect(sent).toEqual([{ status: "done" }]));
  });

  test("SHL-18 a draft is kept for the person signed in, and goes with their sign-out", async () => {
    const client = newClient();
    await mountSignedIn(client);
    settle(() => setAnswerDraft("ask-1", "Yes, ship it"));
    expect(window.sessionStorage.getItem("dispatch.draft:answer:ask-1")).toContain(
      '"login":"reader"'
    );
    settle(() => writesOf(client).signedOut(reader.login));
    expect(answerDraft("ask-1")).toBe("");
    expect(window.sessionStorage.getItem("dispatch.draft:answer:ask-1")).toBeNull();
  });

  test("SHL-20 a live event reaches the page's cache once the person is signed in", async () => {
    const client = newClient();
    const live = fakeLive(client);
    cleanups.push(live.stop);
    const log: EventPages = { pageParams: [null], pages: [[]] };
    client.setQueryData(["events", "AB-1"], log);
    await mountSignedIn(client);
    const event = {
      actor: { id: "alice", kind: "user" },
      created_at: "2026-11-01T00:00:00Z",
      id: 1,
      issue_key: "AB-1",
      notify: true,
      payload: { key: "AB-1", title: "Ship the shell" },
      project: "AB",
      seq: 1,
      type: "issue.updated",
    } as DispatchEvent;
    live.send(event);
    expect(client.getQueryData<EventPages>(["events", "AB-1"])?.pages[0]).toEqual([event]);
  });

  // SignedInParts' duties have their own tests; this says only that the gate mounts it.
  test("SHL-2 the signed-in shell sits in its keys: ? opens the shortcuts", async () => {
    await mountSignedIn();
    settle(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", shiftKey: true, bubbles: true, cancelable: true })
      );
    });
    const sheet = () => document.body.querySelector('[data-slot="sheet-content"]');
    // The sheet's code loads when it first opens, and it takes the focus a moment after.
    await waitFor(() => expect(sheet()?.contains(document.activeElement)).toBe(true));
    expect(sheet()?.querySelector("h2")?.textContent).toBe("Keyboard shortcuts");
  });

  test("a person draws the shell for them", async () => {
    const container = await mountSignedIn();
    // From 768 px the sidebar names the account.
    expect(container.textContent).toContain("Signed in as reader");
  });
});
