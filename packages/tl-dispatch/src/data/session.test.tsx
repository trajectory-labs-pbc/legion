import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";

import { mount } from "../../tests/mount";
import { json } from "../../tests/network";
import { answerRequests } from "../../tests/upstream";
import { until } from "../../tests/wait";
import { reader } from "../../tests/writes";
import { onAnotherPerson, sessionKey, useSession } from "./session";

/** Draws `useSession`; `session` is its newest state. */
function mountSession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let session: ReturnType<typeof useSession> = { state: "loading" };
  function Probe() {
    session = useSession();
    return null;
  }
  mount(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );
  return () => session;
}

describe("useSession", () => {
  test("names the person Dispatch signed in", async () => {
    answerRequests(http.get("/auth/whoami", () => json(reader)));
    const session = mountSession();
    await until(() => session().state === "ready");
    expect(session()).toEqual({ state: "ready", data: reader, refreshError: undefined });
  });

  test("a visitor Dispatch does not know is the signed-out error", async () => {
    const session = mountSession();
    await until(() => session().state === "error");
    expect(session()).toMatchObject({ state: "error", error: { status: 401 } });
  });
});

describe("onAnotherPerson", () => {
  test("calls back when the session names another person, not the same one again", () => {
    const client = new QueryClient();
    client.setQueryData(sessionKey, { ...reader, login: "alice" });
    let calls = 0;
    const stop = onAnotherPerson(client, () => {
      calls += 1;
    });
    client.setQueryData(sessionKey, { ...reader, login: "alice" });
    expect(calls).toBe(0);
    client.setQueryData(sessionKey, { ...reader, login: "bob" });
    expect(calls).toBe(1);
    stop();
    client.setQueryData(sessionKey, { ...reader, login: "carol" });
    expect(calls).toBe(1);
  });

  test("the first person named after none is no change of person", () => {
    const client = new QueryClient();
    let calls = 0;
    onAnotherPerson(client, () => {
      calls += 1;
    });
    client.setQueryData(sessionKey, { ...reader, login: "alice" });
    expect(calls).toBe(0);
    client.setQueryData(sessionKey, { ...reader, login: "bob" });
    expect(calls).toBe(1);
  });
});
