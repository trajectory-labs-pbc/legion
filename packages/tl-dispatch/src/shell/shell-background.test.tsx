import { afterEach, describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useRegistryPolling } from "@/upstream/shell";

import { renderApp } from "../../tests/app";
import { answerShellReads, holdReads, holdShellReads, json, waitFor } from "../../tests/network";
import { settle } from "../../tests/react";
import { closeRefPreview, referenceTriggerProps } from "../../tests/upstream";
import { signedInClient } from "../../tests/writes";
import { ShellBackground } from "./shell-background";

const mounted: { unmount(): void }[] = [];
afterEach(() => {
  // The card's state outlives the tree, so it closes first.
  settle(closeRefPreview);
  for (const view of mounted.splice(0)) view.unmount();
});

/** Draws `children` as a page above the shell's background parts. */
function mount(children: ReactNode) {
  const view = renderApp(
    <>
      {children}
      <ShellBackground closeInboxDrawer={() => {}} inboxDrawerOpen={false} login="reader" />
    </>,
    { client: signedInClient() }
  );
  mounted.push(view);
  return view;
}

describe("ShellBackground", () => {
  test("SHL-9 a part that shows agents has the registry read", async () => {
    const { asked } = answerShellReads((url) =>
      url.endsWith("/api/v1/agents") ? json([]) : undefined
    );
    function RegistryReader() {
      useRegistryPolling(true);
      return null;
    }
    mount(<RegistryReader />);
    await waitFor(() => asked.some((url) => url.endsWith("/api/v1/agents")));
    expect(asked.filter((url) => url.endsWith("/api/v1/agents"))).toHaveLength(1);
  });

  test("SHL-10 a reference on the page opens its preview card", () => {
    holdShellReads();
    holdReads("/api/v1/issues/AB-1");
    const view = mount(
      <Link to="/issues/AB-1" {...referenceTriggerProps({ key: "AB-1", kind: "issue" })}>
        AB-1
      </Link>
    );
    // A focused reference opens the card at once, with no hover delay.
    settle(() => view.container.querySelector("a")?.focus());
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain("AB-1");
  });
});
