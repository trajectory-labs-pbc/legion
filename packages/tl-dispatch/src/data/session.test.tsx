import { describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "msw";

import { mount } from "../../tests/mount";
import { json } from "../../tests/network";
import { answerRequests } from "../../tests/upstream";
import { until } from "../../tests/wait";
import { reader } from "../../tests/writes";
import { useSession } from "./session";

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
