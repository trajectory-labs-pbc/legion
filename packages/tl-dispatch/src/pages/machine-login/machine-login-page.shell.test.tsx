import { afterEach, expect, spyOn, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeymapProvider } from "@upstream-dispatch/features/shell/KeymapProvider";

import { AppShell } from "@/shell/app-shell";
import { MemoryNavigationProvider } from "../../../tests/navigation";
import { holdShellReads } from "../../../tests/network";
import { shellChunksArrive } from "../../../tests/shell-chunks";
import { api } from "./upstream";

const restores: (() => void)[] = [];
afterEach(() => {
  cleanup();
  for (const restore of restores.splice(0)) restore();
});

// The shell moves the focus to `main` when another page opens; the page then takes it to its field.
test("opened by G N from another page, the page gives its code field the focus", async () => {
  holdShellReads();
  const capabilities = spyOn(api, "getCredentialCapabilities").mockResolvedValue({
    machine_code_page: true,
  });
  const logins = spyOn(api, "getMachineLogins").mockResolvedValue({ credentials: [] });
  restores.push(
    () => capabilities.mockRestore(),
    () => logins.mockRestore()
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryNavigationProvider path="/no-such-page">
        <KeymapProvider>
          <AppShell user={{ kind: "user", login: "reader", event_head: "0" }} />
        </KeymapProvider>
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
  await shellChunksArrive();
  const user = userEvent.setup();
  await user.keyboard("gn");
  await waitFor(() => expect(screen.getByLabelText("Code shown on the machine")).toHaveFocus());
  // Again, with the page's code and answers at hand: it draws in the commit that opens it.
  act(() => screen.getByLabelText("Code shown on the machine").blur());
  await user.keyboard("gi");
  await waitFor(() => expect(screen.queryByLabelText("Code shown on the machine")).toBeNull());
  await user.keyboard("gn");
  await waitFor(() => expect(screen.getByLabelText("Code shown on the machine")).toHaveFocus());
}, 20_000);
