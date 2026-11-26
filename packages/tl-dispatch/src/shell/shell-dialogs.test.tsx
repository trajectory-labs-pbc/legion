import { afterEach, describe, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  closeRefPreview,
  referenceTriggerProps,
} from "@upstream-dispatch/features/refs/RefPreview";
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
          <ShellDialogs
            closeCreate={noop}
            closeInboxDrawer={noop}
            closeSearch={noop}
            createOpen={false}
            inboxDrawerOpen={false}
            searchOpen={false}
            shortcuts={{ open: false, sections: [], setOpen: noop, toggle: noop }}
          />
        </MemoryNavigationProvider>
      </QueryClientProvider>
    );
    mounted.push(view);
    // A focused reference opens the card at once, with no hover delay.
    settle(() => view.container.querySelector("a")?.focus());
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain("AB-1");
  });
});
