// Upstream's features/credentials/MachineLoginPage.decided.test.tsx, against the rebuilt page.
import { expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/upstream/api";
import type { RecordResponse } from "@/upstream/contract";
import { MemoryNavigationProvider } from "../../../tests/navigation";
import { MachineLoginPage } from "./machine-login-page";

function machineRecord(decided: RecordResponse["decided"] = null): RecordResponse {
  return {
    approver: "ada",
    decided,
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
    state: decided === null ? "pending" : decided.event,
  };
}

/** The paragraph whose whole text matches; the rebuilt page sets the credential id in its own span. */
const paragraph = (text: string | RegExp) => (_: string, element: Element | null) =>
  element?.tagName === "P" &&
  (typeof text === "string" ? element.textContent === text : text.test(element.textContent ?? ""));

async function lookUp() {
  const user = userEvent.setup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  expect(await screen.findByText("worker-7.example.com")).toBeDefined();
}

for (const [id, button, word] of [
  ["MLD-01", "Approve", /^Approved\./],
  ["MLD-02", "Deny", /^denied/i],
] as const) {
  test(`${id} after ${button} succeeds the page shows the decision and no decision buttons`, async () => {
    const user = userEvent.setup();
    const lookup = spyOn(api, "lookupMachineCredential").mockResolvedValue(machineRecord());
    const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
    const approve = spyOn(api, "approveCredentialRecord").mockResolvedValue({
      credential_id: "cred-9",
      state: "approved",
    });
    const deny = spyOn(api, "denyCredentialRecord").mockResolvedValue({ state: "denied" });
    try {
      await lookUp();
      await user.click(screen.getByRole("button", { name: button }));
      await waitFor(() =>
        expect((button === "Approve" ? approve : deny).mock.calls.length).toBe(1)
      );
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
      );
      expect(screen.queryByRole("button", { name: "Deny" })).not.toBeInTheDocument();
      expect(screen.getByText(word)).toBeDefined();
      expect(screen.queryByText(/^Approving lets/)).not.toBeInTheDocument();
      expect(screen.getByLabelText("Code shown on the machine")).toHaveValue("");
    } finally {
      cleanup();
      lookup.mockRestore();
      getMachineLogins.mockRestore();
      approve.mockRestore();
      deny.mockRestore();
    }
  });
}

for (const [id, decided, word] of [
  [
    "MLD-03",
    { at: "2026-09-27T00:05:00Z", credential_id: "cred-9", event: "approved" },
    /^Approved\./,
  ],
  ["MLD-04", { at: "2026-09-27T00:05:00Z", credential_id: null, event: "denied" }, /^denied/i],
] as const) {
  test(`${id} a looked-up login already ${decided.event} shows its decision and no decision buttons`, async () => {
    const lookup = spyOn(api, "lookupMachineCredential").mockResolvedValue(
      machineRecord({ ...decided })
    );
    const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
    try {
      await lookUp();
      expect(screen.getByText(word)).toBeDefined();
      expect(screen.queryByText(/^Approving lets/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Deny" })).not.toBeInTheDocument();
      if (decided.credential_id === null) {
        expect(screen.queryByText(paragraph(/^Credential /))).not.toBeInTheDocument();
      } else {
        expect(screen.getByText(paragraph(`Credential ${decided.credential_id}`))).toBeDefined();
      }
    } finally {
      cleanup();
      lookup.mockRestore();
      getMachineLogins.mockRestore();
    }
  });
}

for (const [id, when, decided] of [
  ["MLD-05", "before the sweep", null],
  [
    "MLD-06",
    "after the sweep",
    { at: "2026-09-27T01:00:00Z", credential_id: null, event: "expired" },
  ],
] as const) {
  test(`${id} a looked-up login that expired before anyone decided it offers no decision (${when})`, async () => {
    const lookup = spyOn(api, "lookupMachineCredential").mockResolvedValue({
      ...machineRecord(decided === null ? null : { ...decided }),
      state: "expired",
    });
    const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
    try {
      await lookUp();
      expect(screen.getByText("This login expired before anyone decided it.")).toBeDefined();
      expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Deny" })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Approving lets/)).not.toBeInTheDocument();
    } finally {
      cleanup();
      lookup.mockRestore();
      getMachineLogins.mockRestore();
    }
  });
}

test("MLD-07 a looked-up approved service's login says it starts worker pods as the service", async () => {
  const lookup = spyOn(api, "lookupMachineCredential").mockResolvedValue({
    ...machineRecord({ at: "2026-09-27T00:05:00Z", credential_id: "cred-9", event: "approved" }),
    service: "legion-daemon",
  });
  const getMachineLogins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  try {
    await lookUp();
    expect(
      await screen.findByText(
        "Approved. legion-daemon on worker-7.example.com can start worker pods as legion-daemon."
      )
    ).toBeDefined();
    expect(screen.queryByText(/can start agent sessions as you/)).not.toBeInTheDocument();
  } finally {
    cleanup();
    lookup.mockRestore();
    getMachineLogins.mockRestore();
  }
});
