// Upstream's features/credentials/MachineLoginPage.test.tsx, against the rebuilt page.
import { expect, jest, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { realClock } from "@upstream-dispatch/__tests__/fake-clock";
import { keyedAttempt } from "@upstream-dispatch/__tests__/keyed-attempt";
import { stopTheLateWrite } from "@upstream-dispatch/__tests__/stop-late-write";
import { userOnFakeClock } from "@upstream-dispatch/__tests__/user";
import { ApiError, NetworkError } from "@upstream-dispatch/api/client";

import { MemoryNavigationProvider } from "../../../tests/navigation";
import { MachineLoginPage } from "./machine-login-page";
import { api, type RecordResponse, stoppedWriteNote } from "./upstream";

function machineRecord(overrides: Partial<RecordResponse> = {}): RecordResponse {
  return {
    approver: "ada",
    decided: null,
    enrollment: null,
    expires_at: "2026-09-27T01:00:00Z",
    identifiers: ["worker-7.example.com"],
    kind: "launcher_credential",
    lifetime_seconds: 900,
    reason: "",
    record_id: "req-2",
    requested_at: "2026-09-27T00:00:00Z",
    rules_version: "v3",
    service: null,
    session: { enrollment: null, request: null },
    state: "pending",
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryNavigationProvider path="/credentials/machine">
      <QueryClientProvider client={queryClient}>
        <MachineLoginPage />
      </QueryClientProvider>
    </MemoryNavigationProvider>
  );
}

test("MLP-01 code -> lookup -> Approve posts the looked-up code", async () => {
  const user = userEvent.setup();
  const lookupMachineCredential = spyOn(api, "lookupMachineCredential").mockResolvedValue(
    machineRecord()
  );
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const approveCredentialRecord = spyOn(api, "approveCredentialRecord").mockResolvedValue({
    credential_id: "cred-9",
    state: "approved",
  });

  try {
    renderPage();
    await user.click(screen.getByLabelText("Code shown on the machine"));
    await user.paste("abcd1234");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await waitFor(() =>
      expect(lookupMachineCredential).toHaveBeenCalledWith("ABCD-1234", keyedAttempt)
    );
    expect(await screen.findByText("worker-7.example.com")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approveCredentialRecord).toHaveBeenCalledTimes(1));
    expect(approveCredentialRecord).toHaveBeenCalledWith(
      "req-2",
      { code: "ABCD-1234" },
      keyedAttempt
    );
  } finally {
    cleanup();
    lookupMachineCredential.mockRestore();
    getMachineLogins.mockRestore();
    approveCredentialRecord.mockRestore();
  }
});

test("MLP-02 a NO_SUCH_CODE lookup failure renders inline under the input", async () => {
  const user = userEvent.setup();
  const lookupMachineCredential = spyOn(api, "lookupMachineCredential").mockRejectedValue(
    new ApiError(404, { code: "NO_SUCH_CODE", error: "No pending request matches that code." })
  );
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });

  try {
    renderPage();
    await user.click(screen.getByLabelText("Code shown on the machine"));
    await user.paste("zzzz9999");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    expect(await screen.findByText("No pending request matches that code.")).toBeDefined();
    expect(screen.queryByText("worker-7.example.com")).not.toBeInTheDocument();
  } finally {
    cleanup();
    lookupMachineCredential.mockRestore();
    getMachineLogins.mockRestore();
  }
});

test("MLP-03 code -> lookup -> Deny posts the looked-up code too", async () => {
  const user = userEvent.setup();
  const lookupMachineCredential = spyOn(api, "lookupMachineCredential").mockResolvedValue(
    machineRecord()
  );
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const denyCredentialRecord = spyOn(api, "denyCredentialRecord").mockResolvedValue({
    state: "denied",
  });

  try {
    renderPage();
    await user.click(screen.getByLabelText("Code shown on the machine"));
    await user.paste("abcd1234");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await waitFor(() =>
      expect(lookupMachineCredential).toHaveBeenCalledWith("ABCD-1234", keyedAttempt)
    );
    expect(await screen.findByText("worker-7.example.com")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Deny" }));
    await waitFor(() => expect(denyCredentialRecord).toHaveBeenCalledTimes(1));
    expect(denyCredentialRecord).toHaveBeenCalledWith("req-2", { code: "ABCD-1234" }, keyedAttempt);
  } finally {
    cleanup();
    lookupMachineCredential.mockRestore();
    denyCredentialRecord.mockRestore();
    getMachineLogins.mockRestore();
  }
});

test("MLP-04 a pending service login offers Deny alone", async () => {
  const user = userEvent.setup();
  const lookupMachineCredential = spyOn(api, "lookupMachineCredential").mockResolvedValue(
    machineRecord({ approver: "anyone", service: "legion-daemon" })
  );
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const denyCredentialRecord = spyOn(api, "denyCredentialRecord").mockResolvedValue({
    state: "denied",
  });

  try {
    renderPage();
    await user.click(screen.getByLabelText("Code shown on the machine"));
    await user.paste("abcd1234");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    await waitFor(() =>
      expect(lookupMachineCredential).toHaveBeenCalledWith("ABCD-1234", keyedAttempt)
    );
    expect(await screen.findByRole("button", { name: "Deny" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.getByText("Approver: Anyone signed in to Dispatch")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Deny" }));
    await waitFor(() =>
      expect(denyCredentialRecord).toHaveBeenCalledWith(
        "req-2",
        { code: "ABCD-1234" },
        keyedAttempt
      )
    );
  } finally {
    cleanup();
    lookupMachineCredential.mockRestore();
    denyCredentialRecord.mockRestore();
    getMachineLogins.mockRestore();
  }
});

/** A fetch that failed, which the write is tried again after: it goes late, for the reader to stop. */
const dropped = () => new NetworkError("/api/v1/credential-requests", new TypeError("Failed"));

/** The page on the held clock, with the code looked up when `answerLookup` is given. */
async function stoppedPage(
  queryClient: QueryClient,
  answerLookup?: (record: RecordResponse) => void
) {
  const user = userOnFakeClock();
  render(
    <MemoryNavigationProvider path="/credentials/machine">
      <QueryClientProvider client={queryClient}>
        <MachineLoginPage />
      </QueryClientProvider>
    </MemoryNavigationProvider>
  );
  await user.click(screen.getByLabelText("Code shown on the machine"));
  await user.paste("abcd1234");
  await user.click(screen.getByRole("button", { name: "Look up" }));
  if (answerLookup !== undefined) {
    await act(async () => {
      answerLookup(machineRecord());
    });
    await screen.findByText("worker-7.example.com");
  }
  return user;
}

test("MLP-05 a lookup the reader stopped says it may have been made", async () => {
  jest.useFakeTimers();
  const lookup = spyOn(api, "lookupMachineCredential").mockRejectedValue(dropped());
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await stoppedPage(queryClient);
    await stopTheLateWrite(queryClient);
    expect(
      screen.getByText(
        stoppedWriteNote("the lookup of that code", "made", {
          anew: "Look up sends the code in the field as a new lookup.",
        })
      )
    ).toBeDefined();
  } finally {
    realClock();
    cleanup();
    queryClient.clear();
    lookup.mockRestore();
    getMachineLogins.mockRestore();
  }
});

test("MLP-06 an approval the reader stopped says it may have been made", async () => {
  jest.useFakeTimers();
  const lookedUp = Promise.withResolvers<RecordResponse>();
  const lookup = spyOn(api, "lookupMachineCredential").mockReturnValue(lookedUp.promise);
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const approve = spyOn(api, "approveCredentialRecord").mockRejectedValue(dropped());
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const user = await stoppedPage(queryClient, lookedUp.resolve);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await stopTheLateWrite(queryClient);
    expect(
      screen.getByText(
        stoppedWriteNote("the approval", "made", {
          anew: "Pressing Approve again sends a new approval.",
        })
      )
    ).toBeDefined();
  } finally {
    realClock();
    cleanup();
    queryClient.clear();
    lookup.mockRestore();
    getMachineLogins.mockRestore();
    approve.mockRestore();
  }
});

test("MLP-07 a denial the reader stopped says it may have been made", async () => {
  jest.useFakeTimers();
  const lookedUp = Promise.withResolvers<RecordResponse>();
  const lookup = spyOn(api, "lookupMachineCredential").mockReturnValue(lookedUp.promise);
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const deny = spyOn(api, "denyCredentialRecord").mockRejectedValue(dropped());
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const user = await stoppedPage(queryClient, lookedUp.resolve);
    await user.click(screen.getByRole("button", { name: "Deny" }));
    await stopTheLateWrite(queryClient);
    expect(
      screen.getByText(
        stoppedWriteNote("the denial", "made", { anew: "Pressing Deny again sends a new denial." })
      )
    ).toBeDefined();
  } finally {
    realClock();
    cleanup();
    queryClient.clear();
    lookup.mockRestore();
    getMachineLogins.mockRestore();
    deny.mockRestore();
  }
});

/** Each decision, the button pressed, the one that waits for it, and the call it sends. */
const DECISIONS: readonly (readonly [
  id: string,
  pressed: string,
  other: string,
  call: "approveCredentialRecord" | "denyCredentialRecord",
])[] = [
  ["MLP-08", "Approve", "Deny", "approveCredentialRecord"],
  ["MLP-10", "Deny", "Approve", "denyCredentialRecord"],
];

test.each(
  DECISIONS
)("%s %s keeps the focus while it is out, %s waits for it, and its refusal is announced", async (_id, pressed, other, call) => {
  const user = userEvent.setup();
  const lookup = spyOn(api, "lookupMachineCredential").mockResolvedValue(machineRecord());
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  const answer = Promise.withResolvers<never>();
  const decide = spyOn(api, call).mockReturnValue(answer.promise);
  try {
    renderPage();
    await user.click(screen.getByLabelText("Code shown on the machine"));
    await user.paste("abcd1234");
    await user.click(screen.getByRole("button", { name: "Look up" }));
    const pressedButton = await screen.findByRole("button", { name: pressed });
    await user.click(pressedButton);
    await waitFor(() => expect(pressedButton).toHaveAttribute("aria-busy", "true"));
    expect(pressedButton).toHaveFocus();
    const otherButton = screen.getByRole("button", { name: other });
    expect(otherButton).not.toHaveAttribute("aria-busy");
    // The guard would drop a second decision, so the other button does not offer one.
    expect(otherButton).toBeDisabled();
    answer.reject(new ApiError(409, { code: "DECIDED", error: "Someone decided it first." }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone decided it first.");
    expect(otherButton).toBeEnabled();
  } finally {
    cleanup();
    lookup.mockRestore();
    getMachineLogins.mockRestore();
    decide.mockRestore();
  }
});

test("MLP-09 Look up waits for a code, keeps the focus while it is out, and a refused lookup is announced", async () => {
  const user = userEvent.setup();
  const answer = Promise.withResolvers<never>();
  const lookup = spyOn(api, "lookupMachineCredential").mockReturnValue(answer.promise);
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    renderPage();
    const button = screen.getByRole("button", { name: "Look up" });
    expect(button).toBeDisabled();
    await user.click(screen.getByLabelText("Code shown on the machine"));
    await user.paste("abcd1234");
    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    expect(button).toHaveFocus();
    answer.reject(new ApiError(404, { code: "NOT_FOUND", error: "No login waits on that code." }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No login waits on that code.");
  } finally {
    cleanup();
    lookup.mockRestore();
    getMachineLogins.mockRestore();
  }
});
