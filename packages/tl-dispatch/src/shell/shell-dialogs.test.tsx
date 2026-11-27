import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import {
  closeRefPreview,
  referenceTriggerProps,
} from "@upstream-dispatch/features/refs/RefPreview";
import { act } from "react";
import { Link } from "react-router-dom";

import { MemoryNavigationProvider } from "../../tests/navigation";
import { holdReads, holdShellReads } from "../../tests/network";
import { render, settle } from "../../tests/react";
import { ShellDialogs } from "./shell-dialogs";

const noop = () => {};

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  // The card's state outlives the tree, so it closes first.
  settle(closeRefPreview);
  for (const view of mounted.splice(0)) view.unmount();
});

function dialogs(createOpen: boolean) {
  return (
    <ShellDialogs
      closeCreate={noop}
      closeInboxDrawer={noop}
      closeSearch={noop}
      createOpen={createOpen}
      inboxDrawerOpen={false}
      searchOpen={false}
      shortcuts={{ open: false, sections: [], setOpen: noop, toggle: noop }}
    />
  );
}

const form = () => document.body.querySelector('form[aria-label="Create issue"]');

describe("ShellDialogs", () => {
  test("SHL-10 a reference on the page opens its preview card", () => {
    holdShellReads();
    holdReads("/api/v1/issues/AB-1");
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryNavigationProvider path="/">
          <Link to="/issues/AB-1" {...referenceTriggerProps({ key: "AB-1", kind: "issue" })}>
            AB-1
          </Link>
          {dialogs(false)}
        </MemoryNavigationProvider>
      </QueryClientProvider>
    );
    mounted.push(view);
    // A focused reference opens the card at once, with no hover delay.
    settle(() => view.container.querySelector("a")?.focus());
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain("AB-1");
  });

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
      await import("@upstream-dispatch/features/issue/CreateIssueDialog");
    });
    expect(form()).toBeNull();
    view.rerender(wrapped(true));
    await waitFor(() => expect(form()).not.toBeNull());
    // Closed, it is gone, so the next open starts a fresh draft.
    view.rerender(wrapped(false));
    expect(form()).toBeNull();
  });
});
