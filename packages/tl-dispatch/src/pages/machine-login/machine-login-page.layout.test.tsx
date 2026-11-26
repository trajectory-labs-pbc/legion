import { afterEach, expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MemoryNavigationProvider } from "../../../tests/navigation";
import { MachineLoginPage } from "./machine-login-page";
import { api, type RecordResponse } from "./upstream";

const record: RecordResponse = {
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
};

const restores: (() => void)[] = [];
afterEach(() => {
  cleanup();
  for (const restore of restores.splice(0)) restore();
});

const login = (credential_id: string, host: string) => ({
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

function stub(
  looked: RecordResponse = record,
  credentials = [login("cred-devbox", "devbox.example.com")]
) {
  const lookup = spyOn(api, "lookupMachineCredential").mockResolvedValue(looked);
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials });
  restores.push(
    () => lookup.mockRestore(),
    () => logins.mockRestore()
  );
}

function renderPage() {
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

const primaries = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.className.includes("bg-primary"))
    .map((button) => button.textContent);

async function lookUp(headline = "worker-7.example.com asks to start agent sessions as you") {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Code shown on the machine"));
  await user.paste("abcd1234");
  await user.click(screen.getByRole("button", { name: "Look up" }));
  return screen.findByRole("heading", { name: headline });
}

test("one 720 px column with one primary action: Look up, then Approve once a request shows", async () => {
  stub();
  const view = renderPage();
  expect(view.container.querySelector("section")?.className).toContain("max-w-180");
  expect(primaries()).toEqual(["Look up"]);
  await lookUp();
  expect(primaries()).toEqual(["Approve"]);
  expect(screen.getByRole("button", { name: "Look up" }).className).toContain("border-input");
});

test("the code field has the focus when the page opens, so typing goes to it", async () => {
  stub();
  renderPage();
  await waitFor(() => expect(screen.getByLabelText("Code shown on the machine")).toHaveFocus());
});

test("an approval takes the focus to what it did, empties the field, and marks the new login", async () => {
  stub(record, [
    login("cred-devbox", "devbox.example.com"),
    login("cred-9", "worker-7.example.com"),
  ]);
  const approve = spyOn(api, "approveCredentialRecord").mockResolvedValue({
    credential_id: "cred-9",
    state: "approved",
  });
  restores.push(() => approve.mockRestore());
  renderPage();
  await lookUp();
  expect(screen.queryByText("New")).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Approve" }));
  const outcome = await screen.findByText(/^Approved\./);
  await waitFor(() => expect(document.activeElement?.contains(outcome)).toBe(true));
  const field = screen.getByLabelText("Code shown on the machine");
  expect(field).toHaveValue("");
  // Nothing is left to do with that code, so no button leads until a new one is typed.
  expect(primaries()).toEqual([]);
  expect((await screen.findByText("New")).closest("tr")?.textContent).toContain("cred-9");
  await user.type(field, "efgh5678");
  expect(primaries()).toEqual(["Look up"]);
});

test.each([
  [
    "a service's login, which shows Deny alone",
    { ...record, approver: "anyone", service: "legion-daemon" },
    "worker-7.example.com asks to start worker pods as legion-daemon",
  ],
  [
    "an expired login",
    { ...record, state: "expired" },
    "worker-7.example.com asked to start agent sessions as you",
  ],
] as const)("Look up stays the primary action for %s", async (_name, looked, headline) => {
  stub(looked);
  renderPage();
  await lookUp(headline);
  expect(primaries()).toEqual(["Look up"]);
});

test("the headline names the machine and what it asks, over its durations and its approver", async () => {
  stub();
  renderPage();
  await lookUp();
  const lasts = screen.getByText("Login lasts 15 minutes");
  const expires = screen.getByText(
    (_, element) => element?.tagName === "P" && /^Request expires/.test(element.textContent ?? "")
  );
  const approver = screen.getByText("Approver: ada");
  for (const row of [lasts, expires, approver]) expect(row.className).toContain("h-8");
  expect(screen.queryByText(/Machine login$/)).toBeNull();
});

test("the policy text folds behind a marked trigger, and only the question's Revoke is destructive", async () => {
  stub();
  renderPage();
  const user = userEvent.setup();
  const section = within(await screen.findByRole("region", { name: "Machine logins" }));
  const revoke = await section.findByRole("button", {
    name: "Revoke the machine login for devbox.example.com, credential cred-devbox",
  });
  expect(revoke.getAttribute("data-variant")).toBe("outline");
  const how = section.getByRole("button", { name: "How machine logins work" });
  expect(how.querySelector('svg[data-icon="inline-end"]')).not.toBeNull();
  expect(section.queryByText(/^Every machine and every pod/)).toBeNull();
  await user.click(how);
  expect(section.getByText(/^Every machine and every pod/)).toBeDefined();
  await user.click(revoke);
  const question = await screen.findByRole("alertdialog");
  const confirm = within(question).getByRole("button", { name: "Revoke" });
  expect(confirm.getAttribute("data-variant")).toBe("destructive");
});
