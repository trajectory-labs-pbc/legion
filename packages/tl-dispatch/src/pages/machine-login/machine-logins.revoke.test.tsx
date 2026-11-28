// Upstream's features/credentials/RevocableList.test.tsx, against the rebuilt list. Only the
// machine logins section is rebuilt; the grants and sign-ins sections stay upstream's.
// Changed from upstream, RVL-01 to RVL-07: a row's name also carries its credential id, so each
// row's Revoke has its own accessible name; Revoke asks in a dialog, not the browser's confirm; the
// pressed Revoke shows its revoke is out and keeps the focus; a refusal shows under its row.
import { expect, jest, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, api, NetworkError } from "@/upstream/api";
import { stoppedWriteNote } from "@/upstream/writes";
import { confirmRevoke } from "../../../tests/machine-logins";
import {
  keyedAttempt,
  realClock,
  stopTheLateWrite,
  tick,
  userOnFakeClock,
} from "../../../tests/upstream";
import { MachineLogins } from "./machine-logins";

const heading = "Machine logins";
const empty = "No live machine logins.";
/** The listed row as the section's sentences of its revoke name it. */
const name = "the machine login for devbox.example.com, credential cred-devbox";
const refusal = "only the person who approved a person's machine login may revoke it";
const rowId = "cred-devbox";
const revoke = { name: `Revoke ${name}` };
/** The row listed beside it, whose Revoke waits while another revoke is out. */
const other = {
  name: "Revoke the machine login for laptop.example.com, credential cred-laptop",
};

/** A third row, listed after the other two. */
const tablet = {
  approved_by: "ada@example.com",
  credential_id: "cred-tablet",
  expired: false,
  expires_at: "2026-10-08T08:00:00Z",
  host: "tablet.example.com",
  issued_at: "2026-10-01T08:00:00Z",
  person: null,
  service: null,
  subject: null,
};
const tabletRevoke = {
  name: "Revoke the machine login for tablet.example.com, credential cred-tablet",
};

function stub(revokeCall: (id: string) => Promise<void>, more: (typeof tablet)[] = []) {
  let credentials = [
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
    {
      approved_by: "ada@example.com",
      credential_id: "cred-laptop",
      expired: false,
      expires_at: "2026-10-09T08:00:00Z",
      host: "laptop.example.com",
      issued_at: "2026-10-02T08:00:00Z",
      person: null,
      service: null,
      subject: null,
    },
    ...more,
  ];
  const list = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials });
  const spy = spyOn(api, "revokeMachineLogin").mockImplementation(revokeCall);
  return {
    clearList: () => {
      list.mockResolvedValue({ credentials: [] });
    },
    /** The next list reads leave `id` out. */
    dropRow: (id: string) => {
      credentials = credentials.filter((login) => login.credential_id !== id);
      list.mockResolvedValue({ credentials });
    },
    /** The next list read fails. */
    failList: () => {
      list.mockRejectedValue(new ApiError(500, { code: "BROKER_DOWN", error: "broker down" }));
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

test("RVL-01 the pressed Revoke shows its revoke is out and keeps the focus; the other rows wait", async () => {
  const user = userEvent.setup();
  const out = Promise.withResolvers<void>();
  const stubs = stub(() => out.promise);
  try {
    const button = await renderSection();
    await user.click(button);
    await confirmRevoke(user);
    await waitFor(() => expect(stubs.revokeCalls()).toEqual([[rowId, keyedAttempt]]));
    await waitFor(() => expect(button).toHaveFocus());
    expect(button).toHaveAttribute("aria-busy", "true");
    const waiting = screen.getByRole("button", other);
    expect(waiting).toBeDisabled();
    expect(waiting).not.toHaveAttribute("aria-busy");

    out.resolve();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
    expect(waiting).toBeEnabled();
  } finally {
    cleanup();
    stubs.restore();
  }
});

test("RVL-02 a double press on the question's Revoke sends one revoke", async () => {
  jest.useFakeTimers();
  const out = Promise.withResolvers<void>();
  const stubs = stub(() => out.promise);
  try {
    const button = await renderSection();
    act(() => {
      fireEvent.click(button);
    });
    const action = within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Revoke",
    });
    act(() => {
      // Two presses in one task, before React re-renders and closes the question.
      fireEvent.click(action);
      fireEvent.click(action);
    });
    await tick(0);
    expect(stubs.revokeCalls()).toEqual([[rowId, keyedAttempt]]);
    out.resolve();
  } finally {
    realClock();
    cleanup();
    stubs.restore();
  }
});

test("RVL-03 a refused revoke shows the broker's refusal under its row, as an alert", async () => {
  const user = userEvent.setup();
  const stubs = stub(async () => {
    throw new ApiError(403, { code: "NOT_APPROVER", error: refusal });
  });
  try {
    const button = await renderSection();
    await user.click(button);
    await confirmRevoke(user);
    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent(`Couldn't revoke ${name} — ${refusal}`);
    expect(line.closest("tr")?.previousElementSibling).toBe(button.closest("tr"));
  } finally {
    cleanup();
    stubs.restore();
  }
});

test("RVL-04 a refused revoke's line goes once its row leaves the list", async () => {
  const user = userEvent.setup();
  const stubs = stub(async () => {
    throw new ApiError(403, { code: "NOT_APPROVER", error: refusal });
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(
      <QueryClientProvider client={queryClient}>
        <MachineLogins />
      </QueryClientProvider>
    );
    const region = within(await screen.findByRole("region", { name: heading }));
    await user.click(await region.findByRole("button", revoke));
    await confirmRevoke(user);
    const line = `Couldn't revoke ${name} — ${refusal}`;
    expect(await region.findByText(line)).toBeDefined();

    stubs.clearList();
    await act(() => queryClient.invalidateQueries());
    expect(await region.findByText(empty)).toBeDefined();
    expect(region.queryByText(line)).not.toBeInTheDocument();
  } finally {
    cleanup();
    queryClient.clear();
    stubs.restore();
  }
});

test("RVL-05 a revoke refreshes the list, so the revoked row leaves it", async () => {
  const user = userEvent.setup();
  const stubs = stub(async () => stubs.clearList());
  try {
    await user.click(await renderSection());
    await confirmRevoke(user);
    const region = within(screen.getByRole("region", { name: heading }));
    expect(await region.findByText(empty)).toBeDefined();
    expect(region.queryByRole("button", revoke)).not.toBeInTheDocument();
    expect(stubs.revokeCalls()).toEqual([[rowId, keyedAttempt]]);
  } finally {
    cleanup();
    stubs.restore();
  }
});

test("RVL-08 a revoked row leaves the list and hands the focus to a listed Revoke, or above the list", async () => {
  const user = userEvent.setup();
  const out = Promise.withResolvers<void>();
  const stubs = stub(async (id) => {
    stubs.dropRow(id);
    if (id === rowId) await out.promise;
  });
  try {
    // The row goes after the question gave its Revoke the focus back.
    const button = await renderSection();
    await user.click(button);
    await confirmRevoke(user);
    await waitFor(() => expect(button).toHaveFocus());
    out.resolve();
    await waitFor(() => expect(button).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", other)).toHaveFocus());

    // The row goes as the question closes.
    await user.click(screen.getByRole("button", other));
    await confirmRevoke(user);
    expect(await screen.findByText(empty)).toBeDefined();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "How machine logins work" })).toHaveFocus()
    );
  } finally {
    cleanup();
    stubs.restore();
  }
});

test("RVL-10 a revoked row hands the focus to a listed Revoke, not to a cut name drawn before it", async () => {
  const user = userEvent.setup();
  // happy-dom lays nothing out; every name reads as cut, so each is a button, while these stand.
  const prototypes = [HTMLSpanElement.prototype, HTMLButtonElement.prototype];
  for (const proto of prototypes) {
    Object.defineProperty(proto, "scrollWidth", { configurable: true, get: () => 200 });
    Object.defineProperty(proto, "clientWidth", { configurable: true, get: () => 100 });
  }
  const out = Promise.withResolvers<void>();
  const stubs = stub(async (id) => {
    stubs.dropRow(id);
    await out.promise;
  });
  try {
    const button = await renderSection();
    expect(screen.getByRole("button", { name: "laptop.example.com" })).toBeDefined();
    await user.click(button);
    await confirmRevoke(user);
    await waitFor(() => expect(button).toHaveFocus());
    out.resolve();
    await waitFor(() => expect(button).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", other)).toHaveFocus());
  } finally {
    cleanup();
    stubs.restore();
    for (const proto of prototypes) {
      Reflect.deleteProperty(proto, "scrollWidth");
      Reflect.deleteProperty(proto, "clientWidth");
    }
  }
});

/** Revokes the `revoked` row of three and expects the focus on `next` once the row goes. */
async function revokeOneOfThree(revoked: { name: string }, next: { name: string }) {
  const user = userEvent.setup();
  const out = Promise.withResolvers<void>();
  const stubs = stub(
    async (id) => {
      stubs.dropRow(id);
      await out.promise;
    },
    [tablet]
  );
  try {
    await renderSection();
    const button = screen.getByRole("button", revoked);
    await user.click(button);
    await confirmRevoke(user);
    await waitFor(() => expect(button).toHaveFocus());
    out.resolve();
    await waitFor(() => expect(button).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", next)).toHaveFocus());
  } finally {
    cleanup();
    stubs.restore();
  }
}

test("RVL-11 a revoked row hands the focus to the next row's Revoke", () =>
  revokeOneOfThree(other, tabletRevoke));

test("RVL-12 the last row, once revoked, hands the focus to the row before it", () =>
  revokeOneOfThree(tabletRevoke, other));

test("RVL-09 a loaded list whose refresh fails keeps its rows and says so, with a Retry", async () => {
  const user = userEvent.setup();
  const stubs = stub(async () => stubs.failList());
  try {
    await user.click(await renderSection());
    await confirmRevoke(user);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load the latest machine logins.");
    expect(screen.getByRole("button", revoke)).toBeDefined();

    stubs.clearList();
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(empty)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  } finally {
    cleanup();
    stubs.restore();
  }
});

test("RVL-06 a revoke the reader stopped says it may have been made", async () => {
  jest.useFakeTimers();
  const user = userOnFakeClock();
  const stubs = stub(async () => {
    throw new NetworkError("/api/v1/revoke", new TypeError("Failed to fetch"));
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(
      <QueryClientProvider client={queryClient}>
        <MachineLogins />
      </QueryClientProvider>
    );
    const region = within(await screen.findByRole("region", { name: heading }));
    await user.click(await region.findByRole("button", revoke));
    await confirmRevoke(user);
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
    stubs.restore();
  }
});

test("RVL-07 a list that fails to load says so as an alert, with a Retry that loads it", async () => {
  const user = userEvent.setup();
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
    expect(alert).toHaveTextContent("Could not load machine logins.");

    list.mockResolvedValue({ credentials: [] });
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(empty)).toBeDefined();
  } finally {
    cleanup();
    list.mockRestore();
  }
});
