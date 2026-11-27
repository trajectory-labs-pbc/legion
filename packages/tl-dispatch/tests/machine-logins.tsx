import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { LauncherCredentialResp, RecordResponse } from "@upstream-dispatch/api/types";

import { MachineLoginPage } from "@/pages/machine-login/machine-login-page";
import { MemoryNavigationProvider } from "./navigation";

/** Answers the open revoke question with its Revoke. */
export async function confirmRevoke(user: UserEvent): Promise<void> {
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Revoke" }));
}

/** A person's machine login request, still waiting for a decision. */
export const pendingRecord = (overrides: Partial<RecordResponse> = {}): RecordResponse => ({
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
});

/** A live machine login of a person's machine, as the logins list returns it. */
export const machineLogin = (credential_id: string, host: string): LauncherCredentialResp => ({
  approved_by: "ada@example.com",
  credential_id,
  expired: false,
  expires_at: "2026-10-10T12:00:00Z",
  host,
  issued_at: "2026-10-03T12:00:00Z",
  person: null,
  service: null,
  subject: null,
});

/** The machine login page at its address, with a query client that does not retry. */
export function renderMachineLoginPage(): ReturnType<typeof render> {
  return render(
    <MemoryNavigationProvider path="/credentials/machine">
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MachineLoginPage />
      </QueryClientProvider>
    </MemoryNavigationProvider>
  );
}

/** Pastes `code` into the page's code field and presses Look up. */
export async function lookUpCode(user: UserEvent, code = "abcd1234"): Promise<void> {
  await user.click(screen.getByLabelText("Code shown on the machine"));
  await user.paste(code);
  await user.click(screen.getByRole("button", { name: "Look up" }));
}
