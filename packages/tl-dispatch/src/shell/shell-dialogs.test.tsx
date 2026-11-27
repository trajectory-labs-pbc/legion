import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { MemoryNavigationProvider } from "../../tests/navigation";
import { holdShellReads } from "../../tests/network";
import { render } from "../../tests/react";
import { ShellDialogs } from "./shell-dialogs";

const noop = () => {};

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount();
});

function dialogs(createOpen: boolean) {
  return (
    <ShellDialogs
      closeCreate={noop}
      closeSearch={noop}
      createOpen={createOpen}
      searchOpen={false}
      shortcuts={{ open: false, sections: [], setOpen: noop, toggle: noop }}
    />
  );
}

const form = () => document.body.querySelector('form[aria-label="Create issue"]');

describe("ShellDialogs", () => {
  test("draws the new-issue dialog, whose code is its own chunk, only while it is open", async () => {
    holdShellReads();
    const client = new QueryClient();
    const wrapped = (createOpen: boolean) => (
      <QueryClientProvider client={client}>
        <MemoryNavigationProvider path="/">{dialogs(createOpen)}</MemoryNavigationProvider>
      </QueryClientProvider>
    );
    const view = render(wrapped(false));
    mounted.push(view);
    // The shell loads the dialog's code when it mounts.
    await act(async () => {
      await import("@/upstream/widgets/create-issue");
    });
    expect(form()).toBeNull();
    view.rerender(wrapped(true));
    await waitFor(() => expect(form()).not.toBeNull());
    // Closed, it is gone, so the next open starts a fresh draft.
    view.rerender(wrapped(false));
    expect(form()).toBeNull();
  });
});
