// Upstream's features/credentials/RevocableList.test.tsx, against the rebuilt table. Only the
// machine logins section is rebuilt; the grants and sign-ins sections stay upstream's.
import { expect, jest, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { realClock, tick } from "@upstream-dispatch/__tests__/fake-clock";
import { keyedAttempt } from "@upstream-dispatch/__tests__/keyed-attempt";
import { stopTheLateWrite } from "@upstream-dispatch/__tests__/stop-late-write";
import { userOnFakeClock } from "@upstream-dispatch/__tests__/user";
import { ApiError, NetworkError } from "@upstream-dispatch/api/client";

import { MachineLogins } from "./machine-logins";
import { api, stoppedWriteNote } from "./upstream";

const heading = "Machine logins";
const empty = "No live machine logins.";
/** The listed row as the section's sentences of its revoke name it. */
const name = "the machine login for devbox.example.com";
const refusal = "only the person who approved a person's machine login may revoke it";
const rowId = "cred-devbox";
const revoke = { name: `Revoke ${name}` };

function stub(revokeCall: (id: string) => Promise<void>) {
  const list = spyOn(api, "getMachineLogins").mockResolvedValue({
    credentials: [
      {
        approved_by: "ada@example.com",
        credential_id: rowId,
        expired: false,
        expires_at: "2026-10-10T12:00:00Z",
        host: "devbox.example.com",
        issued_at: "2026-10-03T12:00:00Z",
        person: null,
        service: null,
        subject: null,
      },
    ],
  });
  const spy = spyOn(api, "revokeMachineLogin").mockImplementation(revokeCall);
  return {
    clearList: () => {
      list.mockResolvedValue({ credentials: [] });
    },
    restore: () => {
      list.mockRestore();
      spy.mockRestore();
    },
    revokeCalls: () => spy.mock.calls,
  };
}

async function renderSection(): Promise<HTMLElement> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MachineLogins />
    </QueryClientProvider>
  );
  const region = within(await screen.findByRole("region", { name: heading }));
  return region.findByRole("button", revoke);
}

test("RVL-01 Revoke is disabled while a revoke is out, and enabled once it settles", async () => {
  const user = userEvent.setup();
  const out = Promise.withResolvers<void>();
  const stubs = stub(() => out.promise);
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  try {
    const button = await renderSection();
    await user.click(button);
    await waitFor(() => expect(stubs.revokeCalls()).toEqual([[rowId, keyedAttempt]]));
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));

    out.resolve();
    const region = within(screen.getByRole("region", { name: heading }));
    await waitFor(() =>
      expect((region.getByRole("button", revoke) as HTMLButtonElement).disabled).toBe(false)
    );
  } finally {
    cleanup();
    confirm.mockRestore();
    stubs.restore();
  }
});

test("RVL-02 a double press before the button disables sends one revoke", async () => {
  jest.useFakeTimers();
  const out = Promise.withResolvers<void>();
  const stubs = stub(() => out.promise);
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  try {
    const button = await renderSection();
    act(() => {
      // Two presses in one task, before React re-renders and disables the button.
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await tick(0);
    expect(stubs.revokeCalls()).toEqual([[rowId, keyedAttempt]]);
    out.resolve();
  } finally {
    realClock();
    cleanup();
    confirm.mockRestore();
    stubs.restore();
  }
});

test("RVL-03 a refused revoke shows the broker's refusal, naming the row", async () => {
  const user = userEvent.setup();
  const stubs = stub(async () => {
    throw new ApiError(403, { code: "NOT_APPROVER", error: refusal });
  });
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  try {
    await user.click(await renderSection());
    expect(await screen.findByText(`Couldn't revoke ${name} — ${refusal}`)).toBeDefined();
  } finally {
    cleanup();
    confirm.mockRestore();
    stubs.restore();
  }
});

test("RVL-04 a refused revoke's line goes once its row leaves the list", async () => {
  const user = userEvent.setup();
  const stubs = stub(async () => {
    throw new ApiError(403, { code: "NOT_APPROVER", error: refusal });
  });
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(
      <QueryClientProvider client={queryClient}>
        <MachineLogins />
      </QueryClientProvider>
    );
    const region = within(await screen.findByRole("region", { name: heading }));
    await user.click(await region.findByRole("button", revoke));
    const line = `Couldn't revoke ${name} — ${refusal}`;
    expect(await region.findByText(line)).toBeDefined();

    stubs.clearList();
    await act(() => queryClient.invalidateQueries());
    expect(await region.findByText(empty)).toBeDefined();
    expect(region.queryByText(line)).not.toBeInTheDocument();
  } finally {
    cleanup();
    queryClient.clear();
    confirm.mockRestore();
    stubs.restore();
  }
});

test("RVL-05 a revoke refreshes the list, so the revoked row leaves it", async () => {
  const user = userEvent.setup();
  const stubs = stub(async () => stubs.clearList());
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  try {
    await user.click(await renderSection());
    const region = within(screen.getByRole("region", { name: heading }));
    expect(await region.findByText(empty)).toBeDefined();
    expect(region.queryByRole("button", revoke)).not.toBeInTheDocument();
    expect(stubs.revokeCalls()).toEqual([[rowId, keyedAttempt]]);
  } finally {
    cleanup();
    confirm.mockRestore();
    stubs.restore();
  }
});

test("RVL-06 a revoke the reader stopped says it may have been made", async () => {
  jest.useFakeTimers();
  const user = userOnFakeClock();
  const stubs = stub(async () => {
    throw new NetworkError("/api/v1/revoke", new TypeError("Failed to fetch"));
  });
  const confirm = spyOn(window, "confirm").mockReturnValue(true);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(
      <QueryClientProvider client={queryClient}>
        <MachineLogins />
      </QueryClientProvider>
    );
    const region = within(await screen.findByRole("region", { name: heading }));
    await user.click(await region.findByRole("button", revoke));
    await stopTheLateWrite(queryClient);
    expect(
      region.getByText(
        stoppedWriteNote(`the revoke of ${name}`, "made", {
          anew: "Pressing Revoke again sends a new revoke.",
        })
      )
    ).toBeDefined();
  } finally {
    realClock();
    cleanup();
    queryClient.clear();
    confirm.mockRestore();
    stubs.restore();
  }
});

test("RVL-07 a list that fails to load says so as an alert", async () => {
  const list = spyOn(api, "getMachineLogins").mockRejectedValue(
    new ApiError(500, { code: "BROKER_DOWN", error: "broker down" })
  );
  try {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MachineLogins />
      </QueryClientProvider>
    );
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Couldn't load machine logins.")).toBeDefined();
  } finally {
    cleanup();
    list.mockRestore();
  }
});
